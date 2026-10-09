import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

describe('App Component', () => {
  it('renders without crashing', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    // Just a simple check to ensure the App component mounts
    expect(document.body).toBeInTheDocument();
  });
});
