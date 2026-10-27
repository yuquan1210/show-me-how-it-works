import { defineConfig, loadEnv } from 'vite';
import { deepseekMiddleware } from './server/deepseek.js';
import { loadAiConfig } from './server/ai-config.js';

export default defineConfig(({mode})=>{
  const env={...loadEnv(mode,process.cwd(),'DEEPSEEK_'),...process.env};
  const config=loadAiConfig({env});
  const middleware=deepseekMiddleware({config});
  return {server:{fs:{deny:['.env','.env.*','*.{crt,pem}','**/.git/**','**/ai.config*.json','**/server/**']}},plugins:[{name:'local-deepseek',configureServer(server){server.middlewares.use(middleware);},configurePreviewServer(server){server.middlewares.use(middleware);}}]};
});
