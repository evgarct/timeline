import type { Preview } from "@storybook/nextjs-vite";
import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    viewport: {
      options: {
        iphone: {
          name: "iPhone",
          styles: { width: "393px", height: "852px" }
        }
      }
    },
    a11y: {
      test: "error"
    }
  },
  initialGlobals: {
    viewport: { value: "iphone", isRotated: false }
  }
};

export default preview;

