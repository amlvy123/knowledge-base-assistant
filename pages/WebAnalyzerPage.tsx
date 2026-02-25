import React, { useState, useEffect, useRef } from 'react';
import { Globe, Download, Loader2, ArrowRight, FileText, ExternalLink, Code, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import { analyzeContent } from '../services/geminiService';
import { STORAGE_KEYS, SettingsConfig } from '../types';
import { DEFAULT_DOC_PROMPT } from '../constants';
import { generateFileName, getWebFallbackName } from '../utils';

interface WebAnalysisResult {
  url: string;
  originalMarkdown: string; // From Jina
  analysis: string;
  status: 'pending' | 'fetching' | 'rendering' | 'analyzing' | 'done' | 'error';
  error?: string;
  isFallback?: boolean;
}

export const WebAnalyzerPage: React.FC = () => {
  const [urls, setUrls] = useState('');
  const [results, setResults] = useState<WebAnalysisResult[]>([]);
  const [prompt, setPrompt] = useState(DEFAULT_DOC_PROMPT);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'result'>('result');
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

  // Hidden container for rendering markdown to HTML for PDF capture
  const hiddenRenderRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const [hiddenContent, setHiddenContent] = useState('');

  useEffect(() => {
    isMountedRef.current = true;
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (saved) {
      try {
        const parsed: SettingsConfig = JSON.parse(saved);
        if (parsed.docPrompt) setPrompt(parsed.docPrompt);
      } catch (e) {
        console.warn("Failed to parse settings", e);
      }
    }
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleStart = async () => {
    const urlList = urls.split('\n').map(u => u.trim()).filter(u => u.length > 0);
    if (urlList.length === 0) return;

    setIsProcessing(true);
    // Initialize results placeholders
    const newResults: WebAnalysisResult[] = urlList.map(url => ({
      url,
      originalMarkdown: '',
      analysis: '',
      status: 'pending'
    }));
    setResults(newResults);

    // Process one by one
    for (let i = 0; i < newResults.length; i++) {
      if (!isMountedRef.current) break;
      
      const item = newResults[i];
      updateStatus(item.url, 'fetching');

      try {
        // 1. Fetch content via r.jina.ai
        const jinaUrl = `https://r.jina.ai/${item.url}`;
        
        // Initial headers setup
        const headers: Record<string, string> = {
            'X-Return-Format': 'markdown'
        };
        
        // Specific tweak for WeChat
        if (item.url.includes('mp.weixin.qq.com')) {
             headers['X-Target-Selector'] = '#js_content';
        }

        let fetchRes = await fetch(jinaUrl, { headers });

        // RETRY LOGIC for WeChat 422
        if (!fetchRes.ok && fetchRes.status === 422 && item.url.includes('mp.weixin.qq.com')) {
             console.log(`WeChat fetch failed (422) for ${item.url}, retrying without selector...`);
             const retryHeaders = { 'X-Return-Format': 'markdown' }; // Clean headers
             fetchRes = await fetch(jinaUrl, { headers: retryHeaders });
        }

        if (!fetchRes.ok) throw new Error(`无法从 ${item.url} 获取内容 (Status: ${fetchRes.status})`);
        
        const markdownContent = await fetchRes.text();
        
        if (!markdownContent || markdownContent.trim().length === 0) {
            throw new Error("抓取的内容为空，请检查链接是否有效");
        }
        
        if (!isMountedRef.current) break;

        updateResult(item.url, { originalMarkdown: markdownContent, status: 'rendering' });

        // 2. Visual PDF Generation Process with Fallback
        let analysisFile: File;
        let analysisMimeType = 'application/pdf';
        let usedFallback = false;

        try {
            // Trigger a render in the hidden area
            setHiddenContent(markdownContent);
            
            // Wait for DOM to update and images to potentially load
            await new Promise(r => setTimeout(r, 2500)); 

            if (!isMountedRef.current) break;
            
            // Check ref existence right before usage
            if (!hiddenRenderRef.current) {
                throw new Error("Render container unavailable");
            }

            const canvas = await html2canvas(hiddenRenderRef.current, {
                useCORS: true, 
                allowTaint: false, 
                logging: false,
                scale: 1.0, 
                backgroundColor: '#ffffff', 
                windowWidth: 1200, 
                x: 0,
                y: 0,
                scrollX: 0,
                scrollY: 0
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.85);
            // jsPDF constructor usage
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'px',
                format: [canvas.width, canvas.height] 
            });
            
            pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
            const pdfBlob = pdf.output('blob');
            analysisFile = new File([pdfBlob], "website_content.pdf", { type: "application/pdf" });
        } catch (renderError) {
            console.warn("PDF generation failed, falling back to text analysis.", renderError);
            usedFallback = true;
            // Fallback: Create a text file from the markdown
            const blob = new Blob([markdownContent], { type: 'text/plain' });
            analysisFile = new File([blob], "website_content.txt", { type: "text/plain" });
            analysisMimeType = 'text/plain';
        }

        updateStatus(item.url, 'analyzing');

        // 3. Send to Gemini
        const analysis = await analyzeContent(analysisFile, prompt, analysisMimeType);
        
        if (!isMountedRef.current) break;

        updateResult(item.url, { analysis, status: 'done', isFallback: usedFallback });

      } catch (err: any) {
        console.error(err);
        if (isMountedRef.current) {
            updateResult(item.url, { status: 'error', error: err.message });
        }
      }
    }
    
    if (isMountedRef.current) {
        setIsProcessing(false);
        setHiddenContent(''); // Cleanup
    }
  };

  const updateStatus = (url: string, status: WebAnalysisResult['status']) => {
    setResults(prev => prev.map(r => r.url === url ? { ...r, status } : r));
  };

  const updateResult = (url: string, updates: Partial<WebAnalysisResult>) => {
    setResults(prev => prev.map(r => r.url === url ? { ...r, ...updates } : r));
  };

  const selectedItem = results.find(r => r.url === selectedUrl);

  const downloadAll = async () => {
    const zip = new JSZip();
    results.filter(r => r.status === 'done').forEach((r, idx) => {
        const fallbackName = getWebFallbackName(r.url, idx);
        const finalName = generateFileName(r.analysis, fallbackName) + ".txt";
        zip.file(finalName, r.analysis);
    });
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "大聪明知识库_网页分析_批量.zip");
  };

  const getStatusLabel = (item: WebAnalysisResult) => {
    if (item.status === 'done' && item.isFallback) return '完成 (纯文本)';
    switch(item.status) {
      case 'pending': return '待处理';
      case 'fetching': return '获取中';
      case 'rendering': return '生成PDF中';
      case 'analyzing': return '分析中';
      case 'done': return '完成';
      case 'error': return '错误';
      default: return item.status;
    }
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col gap-6 relative">
        
       {/* Hidden Render Container for PDF Generation */}
       <div 
          ref={hiddenRenderRef}
          className="fixed top-0 bg-white p-12 prose prose-slate max-w-none"
          style={{ 
              left: '-10000px', 
              width: '1000px', 
              minHeight: '100vh',
              zIndex: -1000, 
              visibility: 'visible',
              opacity: 1, 
              pointerEvents: 'none'
          }}
       >
           <div className="mb-6 border-b pb-4">
             <h1 className="text-3xl font-bold mb-2 text-slate-900">Web Content Capture</h1>
             <p className="text-slate-500">Auto-generated by 大聪明知识库助手</p>
           </div>
           <ReactMarkdown 
             components={{
               img: (props) => (
                 // eslint-disable-next-line jsx-a11y/alt-text
                 <img 
                   {...props} 
                   style={{maxWidth: '100%', maxHeight: '600px'}} 
                   crossOrigin="anonymous" 
                   loading="eager"
                   onError={(e) => {
                       (e.target as HTMLImageElement).style.display = 'none';
                   }}
                 />
               ),
               table: (props) => (
                 <table {...props} className="border-collapse border border-slate-300 w-full my-4" />
               ),
               th: (props) => (
                 <th {...props} className="border border-slate-300 p-2 bg-slate-100 font-bold" />
               ),
               td: (props) => (
                 <td {...props} className="border border-slate-300 p-2" />
               )
             }}
           >
             {hiddenContent}
           </ReactMarkdown>
       </div>

       <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">网页转 PDF 与分析</h2>
          <p className="text-slate-500">批量将 URL 处理为包含表格和图片的 PDF 文档并提取知识。</p>
        </div>
        <div className="flex gap-3">
             <button
                onClick={downloadAll}
                disabled={!results.some(r => r.status === 'done')}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
            >
                <Download size={18} />
                下载全部 (TXT ZIP)
            </button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
          <div className="w-1/3 flex flex-col gap-4 h-full">
               <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2 h-1/3 flex-shrink-0">
                    <label className="text-sm font-semibold text-slate-700">源 URL (每行一个)</label>
                    <textarea 
                        className="flex-1 w-full p-2 border border-slate-200 rounded resize-none focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
                        placeholder="https://mp.weixin.qq.com/s/example&#10;https://example.com/doc-2"
                        value={urls}
                        onChange={e => setUrls(e.target.value)}
                        disabled={isProcessing}
                    />
               </div>
               
               <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2 h-1/3 flex-shrink-0">
                   <label className="text-sm font-semibold text-slate-700">分析提示词</label>
                   <textarea 
                       className="flex-1 w-full p-2 border border-slate-200 rounded resize-none focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
                       value={prompt}
                       onChange={e => setPrompt(e.target.value)}
                   />
               </div>

               <button 
                  onClick={handleStart}
                  disabled={isProcessing || !urls}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-sm disabled:opacity-50 flex justify-center items-center gap-2 flex-shrink-0"
               >
                   {isProcessing ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                   开始批量处理
               </button>

               <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-y-auto p-2 space-y-2 min-h-0">
                   {results.map((r, i) => (
                       <div 
                        key={i}
                        onClick={() => setSelectedUrl(r.url)}
                        className={`p-3 rounded border cursor-pointer text-sm ${selectedUrl === r.url ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:bg-slate-50'}`}
                       >
                           <div className="flex items-center gap-2 mb-1">
                               {r.status === 'pending' && <div className="w-2 h-2 rounded-full bg-slate-300" />}
                               {(r.status === 'fetching' || r.status === 'rendering' || r.status === 'analyzing') && <Loader2 size={12} className="animate-spin text-blue-500" />}
                               {r.status === 'done' && <div className="w-2 h-2 rounded-full bg-green-500" />}
                               {r.status === 'error' && <div className="w-2 h-2 rounded-full bg-red-500" />}
                               <span className="truncate font-medium flex-1">{r.url}</span>
                           </div>
                           <div className="flex justify-between items-center text-xs text-slate-400 pl-4">
                               <span>{getStatusLabel(r)}</span>
                               {r.isFallback && (
                                 <span title="PDF生成失败，仅使用文本分析" className="flex items-center">
                                    <AlertTriangle size={12} className="text-amber-500" />
                                 </span>
                               )}
                           </div>
                       </div>
                   ))}
               </div>
          </div>

          <div className="w-2/3 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-full">
               {selectedItem ? (
                   <>
                     <div className="border-b border-slate-200 flex flex-shrink-0">
                         <button 
                            onClick={() => setActiveTab('result')}
                            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'result' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                         >
                             <FileText size={16} /> 分析结果 (TXT)
                         </button>
                         <button 
                            onClick={() => setActiveTab('preview')}
                            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'preview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                         >
                             <Code size={16} /> 抓取内容预览
                         </button>
                         <div className="ml-auto p-2 flex items-center">
                            <a href={selectedItem.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-blue-500 px-3">
                                <ExternalLink size={16} />
                            </a>
                         </div>
                     </div>
                     <div className="flex-1 overflow-y-auto p-8 prose prose-slate max-w-none">
                         {activeTab === 'result' ? (
                             selectedItem.status === 'done' ? (
                                 <div className="relative">
                                     {selectedItem.isFallback && (
                                         <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded text-sm mb-4 flex items-center gap-2">
                                             <AlertTriangle size={16} />
                                             <span>注意：由于原网页包含无法访问的图片或安全限制，已自动切换为纯文本模式进行分析，视觉图表信息可能丢失。</span>
                                         </div>
                                     )}
                                     <pre className="whitespace-pre-wrap font-mono text-sm text-slate-800">{selectedItem.analysis}</pre>
                                 </div>
                             ) : (
                                 <div className="text-slate-400 italic">等待分析...</div>
                             )
                         ) : (
                             <ReactMarkdown>{selectedItem.originalMarkdown}</ReactMarkdown>
                         )}
                         {selectedItem.status === 'error' && (
                             <div className="text-red-500 p-4 border border-red-200 bg-red-50 rounded mt-4">
                                 错误: {selectedItem.error}
                             </div>
                         )}
                     </div>
                   </>
               ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                        <Globe size={48} className="mb-4 opacity-20" />
                        <p>从列表中选择一个 URL 以查看详情。</p>
                    </div>
               )}
          </div>
      </div>
    </div>
  );
};