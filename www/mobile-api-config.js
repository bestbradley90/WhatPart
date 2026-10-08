// Set this to the deployed HTTPS backend URL before building the mobile app.
window.WHATPART_API_URL = '';

// Load the shared responsive appearance rules in Capacitor builds.
if (!document.querySelector('link[data-whatpart-mobile-theme]')) {
  const mobileTheme = document.createElement('link');
  mobileTheme.rel = 'stylesheet';
  mobileTheme.href = 'mobile-theme.css';
  mobileTheme.dataset.whatpartMobileTheme = 'true';
  document.head.appendChild(mobileTheme);
}
