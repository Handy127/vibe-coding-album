# My Senior High School Memory Album

## Project Overview

My Senior High School Memory Album is a warm, nostalgic interactive photo album website. It presents school memories as collectible photo cards that move through a horizontal card pool, inviting the user to browse, pause, reveal, and react to moments from senior high school life.

The project is currently in the planning stage. No full app implementation has been started yet.

## Core Experience

- Photos appear as collectible memory cards.
- Cards slide horizontally like a soft, continuous card pool.
- The user can drag left or right to refresh or cycle through cards.
- Hovering over a card slows the card movement and slightly enlarges the card.
- Dragging upward flips a card and reveals the photo.
- When a card opens, it enlarges and the page background becomes softly blurred.
- The opened photo includes like and comment buttons in the bottom-right corner.
- Later, hand gestures will control the same actions as dragging and hovering.

## Visual Direction

The album should feel warm, emotional, and handcrafted:

- Soft golden light
- Scrapbook paper texture
- Film strips and photo edges
- Pressed flowers or floral accents
- Cozy high-school memory atmosphere
- Gentle movement instead of flashy effects
- Warm nostalgia rather than futuristic or neon styling

## Project Documents

- `PROJECT_SPEC.md` defines the product scope, interaction rules, and future architecture.
- `ASSET_GUIDE.md` defines the image, texture, and decorative asset direction.
- `TASKS.md` gives the staged task plan for designing and implementing the album later.

## Current Scope

This first step only creates planning documents. The actual website, card interactions, animation system, photo data, and gesture controls will be implemented in later tasks.

## Development

This project now uses Vite, React, and TypeScript.

The easiest way to open the album on Windows is to double-click:

```text
start-album.bat
```

Keep the command window open while viewing the album.

```bash
npm install
npm run dev
```

On this Windows machine, PowerShell may block the `npm` shim. If that happens, use:

```bash
npm.cmd install
npm.cmd run dev
```

Useful scripts:

- `npm run dev` starts the local development server.
- `npm run build` type-checks and builds the site.
- `npm run preview` previews the production build.

## 如何添加照片

把照片放入这个文件夹：

```text
src/assets/memories/
```

支持的格式：

- `jpg`
- `jpeg`
- `png`
- `webp`
- `gif`

文件名会自动变成卡片的稳定 `id` 和默认标题。例如：

```text
jiao-shi-chuang-bian.jpg
shi-tang-wu-hou.jpg
xiao-yuan-xiao-lu.jpg
```

`shi-tang-wu-hou.jpg` 会生成类似 `Shi Tang Wu Hou` 的标题。卡片顺序按文件名排序，所以重命名文件可以调整顺序。

如果开发服务器没有立刻识别新加的图片，请重启：

```bash
npm run dev
```

在这台 Windows 机器上也可以使用：

```bash
npm.cmd run dev
```

## Source Structure

```text
src/
  assets/
    memories/
  components/
  hooks/
  data/
  styles/
  types/
public/
  assets/
  photos/
```
