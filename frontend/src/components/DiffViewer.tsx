import React from 'react';

interface DiffViewerProps {
  prev: any;
  current: any;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ prev, current }) => {
  // Simple JSON line-by-line diff generator
  const getDiffLines = () => {
    const prevStr = JSON.stringify(prev || {}, null, 2);
    const currStr = JSON.stringify(current || {}, null, 2);

    const prevLines = prevStr.split('\n');
    const currLines = currStr.split('\n');

    const lines: { text: string; type: 'unchanged' | 'added' | 'removed' }[] = [];
    
    // Quick alignment algorithm (LCS simplified for configuration sizes)
    let pIdx = 0;
    let cIdx = 0;

    while (pIdx < prevLines.length || cIdx < currLines.length) {
      const pLine = prevLines[pIdx];
      const cLine = currLines[cIdx];

      if (pIdx < prevLines.length && cIdx < currLines.length && pLine === cLine) {
        lines.push({ text: pLine, type: 'unchanged' });
        pIdx++;
        cIdx++;
      } else {
        // Simple lookahead search for alignment
        let foundMatch = false;
        for (let i = 1; i < 5; i++) {
          if (cIdx + i < currLines.length && prevLines[pIdx] === currLines[cIdx + i]) {
            // Added lines in current config
            for (let j = 0; j < i; j++) {
              lines.push({ text: currLines[cIdx + j], type: 'added' });
            }
            cIdx += i;
            foundMatch = true;
            break;
          }
          if (pIdx + i < prevLines.length && prevLines[pIdx + i] === currLines[cIdx]) {
            // Removed lines from previous config
            for (let j = 0; j < i; j++) {
              lines.push({ text: prevLines[pIdx + j], type: 'removed' });
            }
            pIdx += i;
            foundMatch = true;
            break;
          }
        }

        if (!foundMatch) {
          if (pIdx < prevLines.length) {
            lines.push({ text: pLine, type: 'removed' });
            pIdx++;
          }
          if (cIdx < currLines.length) {
            lines.push({ text: cLine, type: 'added' });
            cIdx++;
          }
        }
      }
    }

    return lines;
  };

  const diffLines = getDiffLines();

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-100 font-mono text-xs overflow-hidden leading-relaxed shadow-inner">
      <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex justify-between items-center select-none text-[10px] uppercase font-bold tracking-wider text-slate-500">
        <span>Desired State Configuration Diff</span>
        <div className="flex gap-3">
          <span className="text-emerald-500 font-bold">+ Additions</span>
          <span className="text-rose-500 font-bold">- Deletions</span>
        </div>
      </div>
      <div className="max-h-[300px] overflow-y-auto p-4 space-y-0.5 whitespace-pre">
        {diffLines.map((line, idx) => (
          <div 
            key={idx} 
            className={`px-2 py-0.5 rounded ${
              line.type === 'added' 
                ? 'bg-emerald-950/40 text-emerald-400 border-l-2 border-emerald-500' 
                : line.type === 'removed' 
                ? 'bg-rose-950/40 text-rose-400 line-through border-l-2 border-rose-500' 
                : 'text-slate-400'
            }`}
          >
            {line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
};
