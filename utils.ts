
export const sanitizeFileName = (name: string): string => {
  // Remove illegal characters for filenames on Windows/Linux/Mac
  // Replace slashes, colons, etc. with underscores
  return name.replace(/[\\/:*?"<>|\n\r]/g, "_").trim();
};

export const generateFileName = (content: string, fallbackName: string): string => {
  if (!content) return sanitizeFileName(fallbackName);

  // Strategy 1: Specific field extraction (matching default prompts)
  // Matches: "文档标题：xxx", "视频标题/主题：xxx", "视频标题：xxx", "图片核心标题：xxx"
  const titleMatch = content.match(/(?:文档标题|视频标题\/主题|视频标题|Title|核心标题|图片核心标题)[:：]\s*(.*)/i);
  if (titleMatch && titleMatch[1]) {
    const title = titleMatch[1].trim();
    // Safety check: ignore empty or absurdly long titles (likely parsing errors)
    if (title.length > 0 && title.length < 150) {
      return sanitizeFileName(title);
    }
  }

  // Strategy 2: First Markdown Header (# Title)
  // This is a common fallback if the explicit "Field:" format isn't found
  const headerMatch = content.match(/^#\s+(.*)/m);
  if (headerMatch && headerMatch[1]) {
     const title = headerMatch[1].trim();
     if (title.length > 0 && title.length < 150) {
      return sanitizeFileName(title);
    }
  }
  
  return sanitizeFileName(fallbackName);
};

export const getWebFallbackName = (url: string, index: number): string => {
  try {
    const u = new URL(url);
    // Construct a name from hostname + path, avoiding slashes
    let name = u.hostname.replace('www.', '') + u.pathname.replace(/\//g, '_');
    // Remove trailing underscores
    if (name.endsWith('_')) name = name.slice(0, -1);
    // Limit length
    if (name.length > 50) name = name.substring(0, 50);
    return name || `web_page_${index + 1}`;
  } catch {
    return `web_page_${index + 1}`;
  }
};
