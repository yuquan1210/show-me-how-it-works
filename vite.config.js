import { defineConfig, loadEnv } from 'vite';
import { deepseekMiddleware } from './server/deepseek.js';

export default defineConfig(({mode})=>{
  const env={...loadEnv(mode,process.cwd(),'DEEPSEEK_'),...process.env};
  const middleware=deepseekMiddleware({env});
  return {plugins:[{name:'local-deepseek',configureServer(server){server.middlewares.use(middleware);},configurePreviewServer(server){server.middlewares.use(middleware);}}]};
});
