import React, { useEffect, useState } from 'react';
import { Save, RotateCcw, Activity, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { STORAGE_KEYS, SettingsConfig } from '../types';
import { DEFAULT_DOC_PROMPT, DEFAULT_VIDEO_PROMPT, DEFAULT_IMAGE_PROMPT } from '../constants';
import { testConnection } from '../services/geminiService';

export const SettingsPage: React.FC = () => {
  const [docPrompt, setDocPrompt] = useState(DEFAULT_DOC_PROMPT);
  const [videoPrompt, setVideoPrompt] = useState(DEFAULT_VIDEO_PROMPT);
  const [imagePrompt, setImagePrompt] = useState(DEFAULT_IMAGE_PROMPT);
  const [status, setStatus] = useState<'idle' | 'saved' | 'reset'>('idle');
  
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (saved) {
      const parsed: SettingsConfig = JSON.parse(saved);
      setDocPrompt(parsed.docPrompt || DEFAULT_DOC_PROMPT);
      setVideoPrompt(parsed.videoPrompt || DEFAULT_VIDEO_PROMPT);
      setImagePrompt(parsed.imagePrompt || DEFAULT_IMAGE_PROMPT);
    }
  }, []);

  const handleSave = () => {
    const config: SettingsConfig = { docPrompt, videoPrompt, imagePrompt };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(config));
    setStatus('saved');
    setTimeout(() => setStatus('idle'), 2000);
  };

  const handleReset = () => {
    setDocPrompt(DEFAULT_DOC_PROMPT);
    setVideoPrompt(DEFAULT_VIDEO_PROMPT);
    setImagePrompt(DEFAULT_IMAGE_PROMPT);
    const config: SettingsConfig = { 
      docPrompt: DEFAULT_DOC_PROMPT, 
      videoPrompt: DEFAULT_VIDEO_PROMPT,
      imagePrompt: DEFAULT_IMAGE_PROMPT
    };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(config));
    setStatus('reset');
    setTimeout(() => setStatus('idle'), 2000);
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('');
    try {
      await testConnection();
      setTestStatus('success');
      setTestMessage('API 连接成功！模型响应正常。');
      setTimeout(() => setTestStatus('idle'), 3000);
    } catch (error: any) {
      setTestStatus('error');
      setTestMessage(`连接失败: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">设置控制台</h2>
          <p className="text-slate-500">管理全局提示词和默认配置。</p>
        </div>
        <div className="flex gap-3">
          <button
             onClick={handleTestConnection}
             disabled={testStatus === 'testing'}
             className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
               testStatus === 'error' ? 'bg-red-50 text-red-600 border-red-200' : 
               testStatus === 'success' ? 'bg-green-50 text-green-600 border-green-200' :
               'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
             }`}
          >
             {testStatus === 'testing' ? <Loader2 size={18} className="animate-spin" /> : 
              testStatus === 'success' ? <CheckCircle size={18} /> : 
              testStatus === 'error' ? <AlertCircle size={18} /> :
              <Activity size={18} />
             }
             {testStatus === 'testing' ? '测试中...' : '测试 API 连接'}
          </button>
          
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RotateCcw size={18} />
            重置默认
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Save size={18} />
            {status === 'saved' ? '已保存!' : '保存更改'}
          </button>
        </div>
      </header>

      {testMessage && (
        <div className={`p-4 rounded-lg mb-6 flex items-center gap-2 ${testStatus === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
           {testStatus === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
           <span>{testMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Document Prompt Settings */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
            PDF 与网页分析提示词
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            用于处理文本文档和网页的默认系统提示词。
          </p>
          <textarea
            value={docPrompt}
            onChange={(e) => setDocPrompt(e.target.value)}
            className="w-full h-96 p-4 font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
            placeholder="输入系统提示词..."
          />
        </section>

        {/* Video Prompt Settings */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-2 h-6 bg-purple-500 rounded-full"></span>
            视频分析提示词
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            用于处理视频和音频内容的默认系统提示词。
          </p>
          <textarea
            value={videoPrompt}
            onChange={(e) => setVideoPrompt(e.target.value)}
            className="w-full h-96 p-4 font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
            placeholder="输入系统提示词..."
          />
        </section>

        {/* Image Prompt Settings */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
            图片分析提示词
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            用于单张图片分析的默认提示词。
          </p>
          <textarea
            value={imagePrompt}
            onChange={(e) => setImagePrompt(e.target.value)}
            className="w-full h-96 p-4 font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none"
            placeholder="输入系统提示词..."
          />
        </section>
      </div>
    </div>
  );
};