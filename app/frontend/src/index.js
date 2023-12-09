import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './app/App';
import registerServiceWorker from './registerServiceWorker';
import { BrowserRouter as Router } from 'react-router-dom';

import { init as initApm } from '@elastic/apm-rum'

const apm = initApm({
  serviceName: 'polls-frontend',
  serverUrl: 'https://kibana.polls.com',
  serviceVersion: ''
})

ReactDOM.render(
    <Router>
        <App />
    </Router>,
    document.getElementById('root')
);

registerServiceWorker();
