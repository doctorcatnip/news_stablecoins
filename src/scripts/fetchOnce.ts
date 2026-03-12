import { fetchAllNews } from '../lib/newsFetcher';

fetchAllNews()
  .then((results) => {
    console.log('Done:', results);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
