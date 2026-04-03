import ReactDOM from 'react-dom/client';
import { FloatingWidget } from '../../components/FloatingWidget';
import './style.css';

export default defineContentScript({
  matches: [
    'https://www.linkedin.com/in/*',
    'https://linkedin.com/in/*',
    'https://www.liepin.com/pmresume/*',
    'https://www.liepin.com/resume/*',
  ],
  cssInjectionMode: 'ui',

  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'eagle-widget',
      position: 'overlay',
      zIndex: 999999,
      onMount(container) {
        // Apply base styles to the shadow host container
        container.style.cssText = 'all: initial; display: block;';
        const root = ReactDOM.createRoot(container);
        root.render(<FloatingWidget />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });

    ui.mount();

    // Handle LinkedIn SPA navigation - re-mount when URL changes to a new profile
    let lastUrl = window.location.href;
    const observer = new MutationObserver(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        // Only re-mount if still on a candidate profile URL
        if (isProfileUrl(currentUrl)) {
          ui.remove();
          ui.mount();
        } else {
          ui.remove();
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    ctx.onInvalidated(() => {
      observer.disconnect();
      ui.remove();
    });
  },
});

function isProfileUrl(url: string): boolean {
  return (
    /linkedin\.com\/in\/[^/]+/.test(url) ||
    /liepin\.com\/(pmresume|resume)\//.test(url)
  );
}
