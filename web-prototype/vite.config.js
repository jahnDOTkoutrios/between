import { defineConfig } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';

// Local-only benchmark output, not telemetry. Production has no report endpoint.
function localBenchmarkReports() {
  return { name: 'local-benchmark-reports', configureServer(server) {
    server.middlewares.use('/__test-results', (req, res, next) => {
      if (req.method !== 'POST') return next();
      let body = '';
      req.on('data', chunk => { body += chunk; if (body.length > 128000) req.destroy(); });
      req.on('end', async () => {
        try {
          const report = JSON.parse(body);
          if (report.schemaVersion !== 1 || !Array.isArray(report.cases) || !Array.isArray(report.validation)) throw new Error('Invalid report');
          const folder = new URL('./docs/benchmarks/', import.meta.url);
          await mkdir(folder, { recursive: true });
          await writeFile(new URL('latest.json', folder), JSON.stringify(report, null, 2) + '\n');
          res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"saved":true}');
        } catch { res.writeHead(400); res.end('Invalid benchmark report'); }
      });
    });
  } };
}
export default defineConfig(({ command,isPreview })=>({
  base:command==='build'||isPreview?'/between/':'/',
  plugins:[localBenchmarkReports()],
  server:{host:'127.0.0.1',port:5173,strictPort:true},
}));
