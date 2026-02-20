import { registerRoute, initRouter } from './router';
import { overviewPage } from './pages/overview';
import { dailyPage } from './pages/daily';
import { readingsPage } from './pages/readings';

registerRoute('/', overviewPage);
registerRoute('/daily', dailyPage);
registerRoute('/readings', readingsPage);

initRouter();
