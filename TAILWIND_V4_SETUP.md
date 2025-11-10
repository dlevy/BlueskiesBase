# Tailwind CSS v4 Setup for BlueskiesBase

## ⚠️ Important: Tailwind v4 Changes

Tailwind CSS v4 has a completely different setup process than v3. The old `npx tailwindcss init -p` command **does not work** in v4.

## ✅ Correct Setup for Tailwind v4

### Step 1: Install Tailwind v4
```bash
cd client
npm install tailwindcss@next @tailwindcss/vite@next
```

### Step 2: Configure Vite
Edit `client/vite.config.js`:

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

### Step 3: Update CSS
Edit `client/src/index.css`:

```css
@import "tailwindcss";
```

That's it! **No config file needed** for basic usage.

## Key Differences from v3

| Tailwind v3 | Tailwind v4 |
|-------------|-------------|
| `npm install -D tailwindcss postcss autoprefixer` | `npm install tailwindcss@next @tailwindcss/vite@next` |
| `npx tailwindcss init -p` | Not needed |
| Requires `tailwind.config.js` | Config file optional |
| `@tailwind base; @tailwind components; @tailwind utilities;` | `@import "tailwindcss";` |
| PostCSS plugin | Vite plugin |

## Custom Configuration (Optional)

If you need to customize Tailwind, you can add configuration directly in your CSS file:

```css
@import "tailwindcss";

@theme {
  --color-primary: #3b82f6;
  --font-display: "Inter", sans-serif;
}
```

Or create a `tailwind.config.js` if you prefer:

```javascript
export default {
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
      },
    },
  },
}
```

## Verify Installation

After setup, start your dev server:
```bash
npm run dev
```

Test Tailwind by adding a class to a component:
```jsx
<div className="bg-blue-500 text-white p-4">
  Tailwind is working!
</div>
```

## Troubleshooting

### Error: "could not determine executable to run"
This means you're trying to use the v3 command with v4. Use the installation steps above instead.

### Styles not applying
1. Make sure you imported Tailwind in `index.css`
2. Verify the Vite plugin is added to `vite.config.js`
3. Restart your dev server

### Want to use v3 instead?
If you prefer Tailwind v3, uninstall v4 and install v3:
```bash
npm uninstall tailwindcss @tailwindcss/vite
npm install -D tailwindcss@^3 postcss autoprefixer
npx tailwindcss init -p
```

Then use the old configuration format.

## Resources

- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs/v4-beta)
- [Vite Plugin Documentation](https://tailwindcss.com/docs/v4-beta#vite)

