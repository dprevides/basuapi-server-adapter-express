import { ExpressAdapter } from "./express-adapter"
import { ApplicationConfig} from '@basuapi/api'

describe('express adapter test', () => {
    let target:ExpressAdapter|undefined;
    beforeEach(() => {
        const config = {
            port: 8080
        } as ApplicationConfig;
        target = new ExpressAdapter(config)
    })
    it('should return a Application Request', async () => {
        const result = await target?.getRequest({
            body: {abc: 'body'}
        });
        expect(result?.body).toBeTruthy()
    })
})