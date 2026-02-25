import React, { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, Loader2, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { analyzeContent } from '../services/geminiService';
import { DEFAULT_IMAGE_PROMPT } from '../constants';
import { STORAGE_KEYS, SettingsConfig } from '../types';

export const ImageAnalyzerPage: React.FC = () => {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(DEFAULT_IMAGE_PROMPT);
  const [result, setResult] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (saved) {
      const parsed: SettingsConfig = JSON.parse(saved);
      if (parsed.imagePrompt) {
        setPrompt(parsed.imagePrompt);
      }
    }
  }, []);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setResult(null);
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!image) return;
    setIsProcessing(true);
    try {
      const res = await analyzeContent(image, prompt, image.type);
      setResult(res);
    } catch (e) {
      alert("分析失败");
    }
    setIsProcessing(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-800">图片智能分析</h2>
        <p className="text-slate-500 mt-2">上传图片以获取即时详细分析。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div 
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl h-80 flex flex-col items-center justify-center cursor-pointer transition-colors ${image ? 'border-blue-300 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}
          >
            {preview ? (
              <img src={preview} alt="Preview" className="h-full w-full object-contain rounded-lg p-2" />
            ) : (
              <>
                <ImageIcon size={48} className="text-slate-300 mb-4" />
                <p className="text-slate-500 font-medium">点击上传图片</p>
                <p className="text-xs text-slate-400 mt-1">PNG, JPG, WEBP</p>
              </>
            )}
            <input type="file" ref={inputRef} className="hidden" accept="image/*" onChange={handleSelect} />
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
             <div className="flex justify-between items-center mb-2">
                 <label className="text-sm font-semibold text-slate-700">提示词</label>
                 <span className="text-xs text-slate-400">本次可临时修改</span>
             </div>
             <textarea 
                className="w-full h-40 p-3 font-mono border border-slate-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
             />
             <button 
                onClick={handleAnalyze}
                disabled={!image || isProcessing}
                className="w-full mt-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
             >
                {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                分析图片
             </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-[20rem]">
           <h3 className="font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-100">分析结果</h3>
           {result ? (
               <div className="prose prose-sm prose-slate max-w-none whitespace-pre-wrap font-mono">
                   {/* Directly rendering text since prompt requests TXT format */}
                   {result}
               </div>
           ) : (
               <div className="h-full flex items-center justify-center text-slate-400 italic">
                   结果将显示在这里...
               </div>
           )}
        </div>
      </div>
    </div>
  );
};