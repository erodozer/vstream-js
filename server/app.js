import express from 'express';
import cors from 'cors';
import expressWs from 'express-ws';
import listRoutes from 'express-list-routes';

import { exchangeChannelId } from './utils.js'
import jsonWsHandler from './jsonwss.js';

const app = express();
expressWs(app);

app.use(cors());

const router = express.Router();

/**
 * This provides a simple JSON readable version of the vstream event API
 *
 * Many languages and tooling support JSON out of the box unlike cbor,
 * allow for efficient and accessible handling of the data.
 *
 * It's recommended to consume from vstream's API directly using the
 * library if you are using JS, as the cbor decoding is included.  However,
 * for other tooling where it's more difficult to get cbor working, such
 * as in custom domain languages such as Godot's GDScript, JSON is a
 * the better option.
 */
router.ws('/channel/:channelId', jsonWsHandler);

router.get('/channel/:channelId/websocket', async (req, res) => {
  const {
    params: {
      channelId,
    },
  } = req;

  const wssUrl = await exchangeChannelId(channelId);

  if (wssUrl) {
    res.send(wssUrl);
  } else {
    res.status(404).send();
  }
});

app.use('/', router);

app.listen(8888, () => {
  listRoutes(app);
  console.log('server is listening on 8888');
});
