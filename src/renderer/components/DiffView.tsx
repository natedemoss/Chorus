// Line-level LCS diff. Small inputs, O(n*m) is fine.

export function DiffView({
  filePath,
  oldText,
  newText,
}: {
  filePath?: string;
  oldText: string;
  newText: string;
}) {
  const rows = diffLines(oldText, newText);
  return (
    <div className="diff">
      {filePath && <div className="diff-head">{filePath}</div>}
      <div className="diff-body">
        {rows.map((r, i) => (
          <div key={i} className={`diff-row ${r.kind}`}>
            <span className="diff-gutter">
              {r.kind === "add" ? "+" : r.kind === "del" ? "-" : " "}
            </span>
            <span className="diff-text">{r.text || " "}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WriteDiffView({
  filePath,
  content,
}: {
  filePath?: string;
  content: string;
}) {
  const lines = content.split("\n");
  return (
    <div className="diff">
      {filePath && <div className="diff-head">{filePath} (new file)</div>}
      <div className="diff-body">
        {lines.map((t, i) => (
          <div key={i} className="diff-row add">
            <span className="diff-gutter">+</span>
            <span className="diff-text">{t || " "}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type Row = { kind: "ctx" | "add" | "del"; text: string };

function diffLines(a: string, b: string): Row[] {
  const aa = a.split("\n");
  const bb = b.split("\n");
  const n = aa.length;
  const m = bb.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (aa[i] === bb[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: Row[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (aa[i] === bb[j]) {
      out.push({ kind: "ctx", text: aa[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: "del", text: aa[i] });
      i++;
    } else {
      out.push({ kind: "add", text: bb[j] });
      j++;
    }
  }
  while (i < n) out.push({ kind: "del", text: aa[i++] });
  while (j < m) out.push({ kind: "add", text: bb[j++] });
  return out;
}
