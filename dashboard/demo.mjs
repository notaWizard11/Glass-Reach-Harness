import { startServer } from './server.mjs';
const app=await startServer({demo:true,port:Number(process.env.PORT)||47382});
process.on('SIGINT',()=>{app.stop();process.exit();});
