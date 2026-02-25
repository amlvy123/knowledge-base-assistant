import React from 'react';
import { FileText, Video, Globe, Image as ImageIcon, Settings, Box } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const NavItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        isActive
          ? 'bg-blue-600 text-white shadow-md'
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </Link>
  );
};

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-white border-r border-slate-200 h-screen flex flex-col fixed left-0 top-0 z-10">
      <div className="p-6 flex items-center gap-3 border-b border-slate-100">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
          <Box size={20} />
        </div>
        <h1 className="text-xl font-bold text-slate-800">大聪明知识库助手</h1>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 mb-2 mt-4">
          分析工具
        </div>
        <NavItem to="/" icon={FileText} label="PDF 文档" />
        <NavItem to="/video" icon={Video} label="视频内容" />
        <NavItem to="/web" icon={Globe} label="网页转 PDF" />
        <NavItem to="/image" icon={ImageIcon} label="图片分析" />

        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 mb-2 mt-8">
          系统
        </div>
        <NavItem to="/settings" icon={Settings} label="设置" />
      </nav>

      <div className="p-4 border-t border-slate-100">
        <div className="text-xs text-slate-400 text-center">
          由 Gemini 3 Pro 驱动
        </div>
      </div>
    </aside>
  );
};