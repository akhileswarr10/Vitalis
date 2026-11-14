import { getSpaceWeather } from '../services/spaceWeather.js';
export const spaceWeatherRoute = async (app, opts) => {
    const { config } = opts.deps;
    app.get('/space-weather', async (_req, reply) => {
        const result = await getSpaceWeather(config);
        return reply.status(200).send(result);
    });
};
//# sourceMappingURL=spaceWeather.js.map