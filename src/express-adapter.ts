import express, { NextFunction, Request, Response } from 'express';
import {ApplicationConfig, ApplicationMiddleware, ApplicationRequest, ApplicationResponse} from '@basuapi/api'

import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { IServerAdapter } from '@basuapi/api/dist/adapters/servers/adapter.interface';
export class ExpressAdapter implements IServerAdapter{

    constructor(private config:ApplicationConfig, private app =  express(), private router = express.Router()){
        if (config){
            this.init(config);
        }
    }


    async init(config:ApplicationConfig): Promise<void>{
        function errorHandler (err:any, req:any, res:any, next:any) {
            res.status(500)
            res.render('error', { error: err })
        }

        this.app.use(errorHandler);

        if (config.swaggerDefinition){        
            const swaggerPath = config.swaggerPath ? config.swaggerPath : '/docs';
            this.app.use(swaggerPath, swaggerUi.serve, swaggerUi.setup(YAML.load(config.swaggerDefinition), config.swaggerOptions));
            console.debug("Using swagger definition on path " + swaggerPath)
        }

        this.config = config;
        this.app.use(express.json())
        this.setBeforeRoutingMiddlewares(this.config?.preLoadMiddlewares);
    }
    
    private async setup(){
        if (this.config.prefix){
            this.app.use(this.config.prefix,this.router);
        }else{
            this.app.use(this.router);
        }
        
    }
    
    async start(): Promise<void> {
        await this.setup();
        this.app.listen(this.config.port);
    }

    async setupAndGetApp(): Promise<IServerAdapter> {
        await this.setup();
        this.setAfterRoutingMiddlewares(this.config?.postLoadMiddlewares);
        return this;
    }

    public getPrefix():string|null|undefined{
        return this.config.prefix;
    }


    async setBeforeRoutingMiddlewares(preRouteMiddlewares: ApplicationMiddleware[]): Promise<void> {
        if (!preRouteMiddlewares) return;
        for (let middleware of preRouteMiddlewares){
            console.debug(`Setting up pre route middleware function ${middleware.name}`);
            const loadFunction = middleware.fn as Function;
            this.app.use(middleware.path, async (req:Request,res:Response,next:NextFunction) => {
                const request = await this.getRequest(req);
                const response = await this.getResponse(res);
                await loadFunction(request,response, (status:number, error:any) => {
                    res.status(status).send(error);                    
                }, (data:any) => {
                    res.locals = data;
                    next();
                });
            })
        }
    }
    async setAfterRoutingMiddlewares(afterRouteMiddlewares: ApplicationMiddleware[]): Promise<void> {
        if (!afterRouteMiddlewares) return;
        for (let middleware of afterRouteMiddlewares){
            console.debug(`Setting up post route middleware function ${middleware.name}`);
            const loadFunction = middleware.fn as Function;
            this.app.use(middleware.path,async (req:Request,res:Response,next:NextFunction) => {
                const request = await this.getRequest(req);
                const response = await this.getResponse(res);
                await loadFunction(request,response, (status:number, error:any) => {
                    res.status(status).send(error);                    
                }, (data:any) => {
                    res.locals = data;
                    next();
                });
            })
        }
    }

    public setRoute(method:string, path:string, func:Function){
        (this.router as any)[method](path,func);
        console.debug('Setting route',method, this.config.prefix, path)
    }

    public getPreRoute(){
        return (_req:Request,response:Response,next:NextFunction) => {
            const oldJson = response.json;
            response.json = (body:any) => {
                response.locals.body = body;
                return oldJson.call(response, body);
            };
            next();
        }
    }

    public async send(req:any|express.Request, res:any|express.Response, data:any, status:number){
        return res.status(status).send(data);
    }

    public  async getRequest(request:Express.Request|any) : Promise<ApplicationRequest>{
        // const req =  {...request} as ApplicationRequest;
        const req = {
            accepts: request.accepts,
            baseUrl: request.baseUrl,
            body: request.body,
            cookies: request.cookies,
            headers: request.headers,
            host: request.host,
            hostname: request.hostname,
            ip: request.ip,
            method: request.method,
            originalUrl: request.originalUrl,
            params: request.params,
            path: request.path,
            protocol: request.protocol,
            query: request.query,
            url: request.url
        } as ApplicationRequest


        if (process.env.API_TRACE =="debug"){
            console.debug(request);
        }

        return req;
    }

    public  async getResponse(response:Express.Response|any) : Promise<ApplicationResponse>{

        return {
            body: response.locals.body,
            contentType: response._headers['content-type'] ? response._headers['content-type'][1] : null,
            status: response.statusCode,
            cookie: response._headers['set-cookie'] ? response._headers['set-cookie'] : null,
            headers: response._headers
        } as ApplicationResponse;
    }
}