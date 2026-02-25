import React, { useState, useEffect, useRef } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader2, PlayCircle, Eye, Download, Copy, Video, CloudUpload, MonitorPlay } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { AnalysisFile, AnalysisStatus, STORAGE_KEYS, SettingsConfig } from '../types';
import { DEFAULT_DOC_PROMPT, DEFAULT_VIDEO_PROMPT } from '../constants';
import { analyzeContent } from '../services/geminiService';
import { generateFileName } from '../utils';

// Extend the interface to support custom status text
interface ExtendedAnalysisFile extends AnalysisFile {
    progressText?: string;
}

interface BatchAnalyzerProps {
  mode: 'pdf' | 'video';
}

export const BatchAnalyzerPage: React.FC<BatchAnalyzerProps> = ({ mode }) => {
  const [files, setFiles] = useState<ExtendedAnalysisFile[]>([]);
  const [prompt, setPrompt] = useState('');
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'result'>('preview'); 
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [isQueueProcessing, setIsQueueProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load defaults
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    let defaultPrompt = mode === 'pdf' ? DEFAULT_DOC_PROMPT : DEFAULT_VIDEO_PROMPT;
    
    if (saved) {
      try {
        const parsed: SettingsConfig = JSON.parse(saved);
        if (mode === 'pdf' && parsed.docPrompt) defaultPrompt = parsed.docPrompt;
        if (mode === 'video' && parsed.videoPrompt) defaultPrompt = parsed.videoPrompt;
      } catch (e) {
        console.warn("Failed to parse settings", e);
      }
    }
    setPrompt(defaultPrompt);
  }, [mode]);

  // Handle Preview URL creation/cleanup
  useEffect(() => {
    if (!activeFileId) {
        setPreviewUrl(null);
        return;
    }
    const fileItem = files.find(f => f.id === activeFileId);
    if (fileItem) {
        const url = URL.createObjectURL(fileItem.file);
        setPreviewUrl(url);
        
        // Auto-switch tab based on status
        if (fileItem.status === AnalysisStatus.COMPLETED) {
            setActiveTab('result');
        } else {
            setActiveTab('preview');
        }
        
        return () => {
          if (url) URL.revokeObjectURL(url);
        };
    }
  }, [activeFileId, files.length]);

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles: ExtendedAnalysisFile[] = Array.from(e.target.files).map((f: File) => ({
        id: Math.random().toString(36).substr(2, 9),
        file: f,
        type: mode,
        status: AnalysisStatus.IDLE
      }));
      setFiles(prev => [...prev, ...newFiles]);
      // Auto select the first newly added file
      if (newFiles.length > 0) {
        setActiveFileId(newFiles[0].id);
      }
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    if (activeFileId === id) setActiveFileId(null);
  };

  const clearAll = () => {
    setFiles([]);
    setActiveFileId(null);
  };

  const processQueue = async () => {
    if (isQueueProcessing) return;
    setIsQueueProcessing(true);
    
    const queue = files.filter(f => f.status === AnalysisStatus.IDLE || f.status === AnalysisStatus.FAILED);
    
    for (const fileItem of queue) {
      setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: AnalysisStatus.PROCESSING, progressText: '准备中...' } : f));
      
      try {
        const mimeType = mode === 'pdf' ? 'application/pdf' : fileItem.file.type;
        
        const result = await analyzeContent(fileItem.file, prompt, mimeType, (statusMsg) => {
            setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, progressText: statusMsg } : f));
        });
        
        setFiles(prev => prev.map(f => f.id === fileItem.id ? { 
          ...f, 
          status: AnalysisStatus.COMPLETED,
          progressText: '完成',
          result: result
        } : f));
      } catch (error: any) {
        setFiles(prev => prev.map(f => f.id === fileItem.id ? { 
          ...f, 
          status: AnalysisStatus.FAILED,
          progressText: '失败',
          error: error.message
        } : f));
      }
    }
    setIsQueueProcessing(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadResult = (file: ExtendedAnalysisFile) => {
    const finalName = generateFileName(file.result || '', file.file.name) + ".txt";
    const blob = new Blob([file.result || ''], { type: 'text/plain' });
    saveAs(blob, finalName);
  };

  const downloadAll = async () => {
    const zip = new JSZip();
    files.filter(f => f.status === AnalysisStatus.COMPLETED).forEach((f) => {
        const finalName = generateFileName(f.result || '', f.file.name) + ".txt";
        zip.file(finalName, f.result || '');
    });
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `知识库分析_${mode}_批量.zip`);
  };

  const activeFile = files.find(f => f.id === activeFileId);

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col gap-6">
      <header className="flex justify-between items-center flex-shrink-0">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">
            {mode === 'pdf' ? 'PDF 批量分析' : '视频批量分析'}
          </h2>
          <p className="text-slate-500">上传多个文件，一键提取结构化知识库文档。</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={downloadAll}
            disabled={!files.some(f => f.status === AnalysisStatus.COMPLETED)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
          >
            <Download size={18} />
            下载全部 (ZIP)
          </button>
          <button
            onClick={clearAll}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <X size={18} />
            清空列表
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Left Column: File List & Settings */}
        <div className="lg:col-span-4 flex flex-col gap-4 min-h-0 h-full">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all group flex-shrink-0"
          >
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              {mode === 'pdf' ? <CloudUpload size={24} /> : <MonitorPlay size={24} />}
            </div>
            <p className="text-slate-600 font-medium">点击或拖拽上传 {mode.toUpperCase()}</p>
            <p className="text-xs text-slate-400 mt-1">支持批量选择文件</p>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              multiple 
              accept={mode === 'pdf' ? ".pdf" : "video/*"} 
              onChange={handleFilesSelected} 
            />
          </div>

          <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col min-h-0 shadow-sm">
            <div className="p-4 border-b border-slate-100 font-semibold text-slate-700 flex justify-between items-center">
              <span>文件队列 ({files.length})</span>
              <button 
                onClick={processQueue}
                disabled={isQueueProcessing || files.length === 0}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
              >
                {isQueueProcessing ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
                开始处理
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {files.map(file => (
                <div 
                  key={file.id}
                  onClick={() => setActiveFileId(file.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    activeFileId === file.id ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={activeFileId === file.id ? 'text-blue-600' : 'text-slate-400'}>
                      {mode === 'pdf' ? <FileText size={20} /> : <Video size={20} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{file.file.name}</p>
                      <p className="text-xs text-slate-400">
                        {file.progressText || (file.status === AnalysisStatus.IDLE ? '待处理' : file.status)}
                      </p>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
                      className="text-slate-300 hover:text-red-500 p-1"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  {file.status === AnalysisStatus.PROCESSING && (
                    <div className="mt-2 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 animate-pulse w-full" />
                    </div>
                  )}
                </div>
              ))}
              {files.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10">
                  <Upload size={32} className="opacity-20 mb-2" />
                  <p className="text-sm">暂无待处理文件</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-shrink-0">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">分析提示词</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full h-32 p-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>
        </div>

        {/* Right Column: Preview & Result */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-0 overflow-hidden h-full">
          {activeFile ? (
            <>
              <div className="border-b border-slate-200 flex px-2 bg-slate-50/50 flex-shrink-0">
                <button 
                  onClick={() => setActiveTab('preview')}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'preview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Eye size={18} />
                  内容预览
                </button>
                <button 
                  onClick={() => setActiveTab('result')}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'result' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <CheckCircle size={18} />
                  分析结果
                </button>
                
                <div className="ml-auto flex items-center gap-2 px-4">
                  {activeFile.result && (
                    <>
                      <button 
                        onClick={() => copyToClipboard(activeFile.result!)}
                        className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                        title="复制内容"
                      >
                        <Copy size={18} />
                      </button>
                      <button 
                        onClick={() => downloadResult(activeFile)}
                        className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                        title="下载 TXT"
                      >
                        <Download size={18} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-white">
                {activeTab === 'preview' ? (
                  <div className="h-full">
                    {mode === 'pdf' ? (
                      previewUrl ? (
                        <iframe src={previewUrl} className="w-full h-full border-none" title="PDF Preview" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400">正在加载预览...</div>
                      )
                    ) : (
                      previewUrl ? (
                        <div className="p-8 flex flex-col items-center justify-center h-full bg-slate-900">
                          <video src={previewUrl} controls className="max-w-full max-h-full rounded-lg shadow-2xl" />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400">正在加载视频...</div>
                      )
                    )}
                  </div>
                ) : (
                  <div className="p-8 max-w-4xl mx-auto">
                    {activeFile.status === AnalysisStatus.COMPLETED ? (
                      <div className="prose prose-slate max-w-none">
                        <pre className="whitespace-pre-wrap font-mono text-sm bg-slate-50 p-6 rounded-xl border border-slate-100 text-slate-800">
                          {activeFile.result}
                        </pre>
                      </div>
                    ) : activeFile.status === AnalysisStatus.FAILED ? (
                      <div className="flex flex-col items-center justify-center py-20 text-red-500 gap-4">
                        <AlertCircle size={48} className="opacity-50" />
                        <div className="text-center">
                          <p className="font-semibold text-lg">分析失败</p>
                          <p className="text-sm opacity-80">{activeFile.error}</p>
                        </div>
                        <button 
                          onClick={processQueue}
                          className="mt-4 px-6 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors font-medium"
                        >
                          重试分析
                        </button>
                      </div>
                    ) : activeFile.status === AnalysisStatus.PROCESSING ? (
                      <div className="flex flex-col items-center justify-center py-20 text-blue-500 gap-6">
                        <div className="relative">
                          <div className="w-20 h-20 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin"></div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            {mode === 'pdf' ? <FileText size={24} /> : <Video size={24} />}
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-lg">{activeFile.progressText || '正在分析中...'}</p>
                          <p className="text-sm text-slate-400 mt-1">这通常需要 1-3 分钟，取决于文件大小</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
                        <PlayCircle size={48} className="opacity-20" />
                        <p>点击“开始处理”生成分析结果</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-4">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
                {mode === 'pdf' ? <FileText size={32} /> : <Video size={32} />}
              </div>
              <div className="text-center">
                <p className="font-medium text-slate-500">未选择文件</p>
                <p className="text-sm">从左侧队列中选择一个文件以查看预览或结果</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};