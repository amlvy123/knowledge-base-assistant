import { GoogleGenAI } from "@google/genai";
import { MODEL_NAME } from "../constants";

// Safe API Key access
const getApiKey = () => {
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
    if (process.env.API_KEY) return process.env.API_KEY;
  }
  return "";
};

// Helper to convert File to Base64 (Keep for PDF/Image)
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = (e) => reject(new Error(`FileReader failed: ${e}`));
    reader.readAsDataURL(file);
  });
};

/**
 * Uploads a file to Google Gemini File API via Standard REST.
 * This ensures browser compatibility and avoids complex SDK polyfills for 'fs'.
 */
const uploadFileToGemini = async (file: File, apiKey: string): Promise<{ uri: string; name: string }> => {
  const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`;
  const metadata = { file: { display_name: file.name } };

  try {
    // 1. Initiate Resumable Upload
    const startRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': file.size.toString(),
        'X-Goog-Upload-Header-Content-Type': file.type,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });

    if (!startRes.ok) {
        throw new Error(`Upload Init Failed: ${startRes.status} ${startRes.statusText}`);
    }

    const uploadLocation = startRes.headers.get('X-Goog-Upload-URL');
    if (!uploadLocation) {
        throw new Error("No upload location header received.");
    }

    // 2. Perform Upload
    const uploadRes = await fetch(uploadLocation, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'upload, finalize',
        'X-Goog-Upload-Offset': '0',
        'Content-Length': file.size.toString(),
        'Content-Type': file.type,
      },
      body: file, // Browser automatically handles File/Blob streaming
    });

    if (!uploadRes.ok) {
        throw new Error(`File Transfer Failed: ${uploadRes.status} ${uploadRes.statusText}`);
    }

    const fileInfo = await uploadRes.json();
    return { uri: fileInfo.file.uri, name: fileInfo.file.name };
  } catch (e: any) {
    console.error("Upload Error:", e);
    throw new Error(`视频上传失败: ${e.message}`);
  }
};

/**
 * Polls the file status until it is ACTIVE.
 */
const waitForFileActive = async (fileName: string, apiKey: string): Promise<void> => {
  const checkUrl = `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`;
  
  // Poll max 60 times, every 2 seconds = 2 minutes timeout for processing
  for (let i = 0; i < 60; i++) {
    try {
        const res = await fetch(checkUrl);
        const data = await res.json();
        
        if (data.state === 'ACTIVE') {
            return; // Ready!
        }
        if (data.state === 'FAILED') {
            throw new Error("Google 服务器无法处理此视频文件 (State: FAILED).");
        }
        
        // Wait 2 seconds
        await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
        throw e;
    }
  }
  throw new Error("视频云端处理超时，请稍后重试。");
};

async function retryOperation<T>(
  operation: () => Promise<T>, 
  retries: number = 1, 
  delay: number = 1000
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    const isRetryable = error.status >= 500 || 
                        error.message?.includes('xhr error') || 
                        error.message?.includes('fetch failed');
    
    if (retries > 0 && isRetryable) {
      console.warn(`Retrying operation... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryOperation(operation, retries - 1, delay * 2);
    }
    throw error;
  }
}

export const analyzeContent = async (
  file: File,
  prompt: string,
  mimeType: string,
  onStatusUpdate?: (status: string) => void
): Promise<string> => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error("请在代码或环境变量中配置 process.env.API_KEY");
    }
    
    const ai = new GoogleGenAI({ apiKey });
    let parts: any[] = [];

    // --- VIDEO HANDLING via FILE API ---
    if (mimeType.startsWith('video/')) {
       if (onStatusUpdate) onStatusUpdate("正在上传视频到云端...");
       console.log(`Uploading video: ${file.name} (${(file.size/1024/1024).toFixed(1)}MB)`);
       
       // 1. Upload
       const { uri, name } = await uploadFileToGemini(file, apiKey);
       
       if (onStatusUpdate) onStatusUpdate("等待云端视频处理...");
       // 2. Wait for processing
       await waitForFileActive(name, apiKey);
       
       if (onStatusUpdate) onStatusUpdate("正在生成分析结果...");
       // 3. Construct Request with File URI
       parts = [
           { 
             fileData: { 
               fileUri: uri, 
               mimeType: mimeType 
             } 
           },
           { text: prompt }
       ];
    } 
    // --- PDF/IMAGE HANDLING via INLINE DATA ---
    else {
       if (onStatusUpdate) onStatusUpdate("正在读取文件...");
       const base64Data = await fileToGenerativePart(file);
       parts = [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          { text: prompt }
       ];
       if (onStatusUpdate) onStatusUpdate("正在分析...");
    }

    // Call API with Retry
    const response = await retryOperation(async () => {
        return await ai.models.generateContent({
          model: MODEL_NAME,
          contents: { parts: parts }
        });
    });

    return response.text || "No response text generated.";

  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    
    let msg = error.message || String(error);
    if (msg.includes('413')) msg = "文件内容过大。视频已尝试使用 File API，请检查账户限额。";
    else if (msg.includes('400')) msg = "请求参数错误 (400) 或 API Key 无效。";
    else if (msg.includes('403')) msg = "API Key 权限不足 (403)。请确保 API Key 已开启 Generative Language API。";
    else if (msg.includes('fetch failed')) msg = "网络连接失败。请检查网络。";
    
    if (!msg.includes(error.message)) {
        msg += ` [Detailed Error: ${error.message}]`;
    }
    
    throw new Error(msg);
  }
};

export const testConnection = async (): Promise<string> => {
  try {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy' }); 
    const response = await retryOperation(async () => {
        return await ai.models.generateContent({
            model: 'gemini-3-flash-preview', 
            contents: { parts: [{ text: 'Ping' }] }
        });
    });
    return response.text || "OK";
  } catch (error: any) {
    throw new Error(error.message || "Connection failed");
  }
};