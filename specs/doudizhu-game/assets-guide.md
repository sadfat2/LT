# 斗地主游戏素材准备指南

本指南列出游戏开发所需的全部素材，可提前准备以加快开发进度。

---

## 1. 扑克牌图片（必需）

### 1.1 扑克牌 Sprite Sheet

**规格要求：**
- 格式：PNG（透明背景）
- 单张牌尺寸：**100px × 140px**（可调整，保持 5:7 比例）
- 总图尺寸：**1300px × 560px**（13列 × 4行 + 2张王）

**布局说明：**
```
┌────────────────────────────────────────────────────────────────────┐
│ ♠3  ♠4  ♠5  ♠6  ♠7  ♠8  ♠9  ♠10  ♠J  ♠Q  ♠K  ♠A  ♠2  │ 第1行：黑桃
│ ♥3  ♥4  ♥5  ♥6  ♥7  ♥8  ♥9  ♥10  ♥J  ♥Q  ♥K  ♥A  ♥2  │ 第2行：红桃
│ ♣3  ♣4  ♣5  ♣6  ♣7  ♣8  ♣9  ♣10  ♣J  ♣Q  ♣K  ♣A  ♣2  │ 第3行：梅花
│ ♦3  ♦4  ♦5  ♦6  ♦7  ♦8  ♦9  ♦10  ♦J  ♦Q  ♦K  ♦A  ♦2  │ 第4行：方块
│ 小王 大王 [空] [空] [空] [空] [空] [空] [空] [空] [空] [空] [空] │ 第5行：王
└────────────────────────────────────────────────────────────────────┘
```

**帧索引映射：**
| 牌面 | 索引 |
|------|------|
| 黑桃3 | 0 |
| 黑桃4 | 1 |
| ... | ... |
| 黑桃2 | 12 |
| 红桃3 | 13 |
| ... | ... |
| 方块2 | 51 |
| 小王 | 52 |
| 大王 | 53 |

**设计风格：**
- 经典扑克牌风格
- 红色（♥♦）/ 黑色（♠♣）
- 数字清晰可辨
- 建议圆角设计

**文件名：** `cards.png`

### 1.2 牌背图片

**规格：**
- 尺寸：**100px × 140px**
- 格式：PNG
- 设计：统一的牌背花纹

**文件名：** `card-back.png`

### 1.3 素材来源建议

1. **免费素材网站：**
   - [OpenGameArt](https://opengameart.org/) - 搜索 "playing cards"
   - [Kenney.nl](https://kenney.nl/assets/playing-cards) - 有免费扑克牌素材
   - [itch.io](https://itch.io/game-assets/free/tag-cards) - 免费游戏素材

2. **AI 生成：**
   - 使用 Midjourney / DALL-E 生成扑克牌设计
   - 提示词示例：`"playing card sprite sheet, 54 cards, poker deck, clean design, white background, --ar 13:5"`

3. **自行设计：**
   - 使用 Figma / Photoshop 设计
   - 只需设计花色和数字，批量生成

---

## 2. UI 素材（必需）

### 2.1 按钮图片

| 文件名 | 尺寸 | 说明 |
|--------|------|------|
| `btn-primary.png` | 200×60 | 主要按钮（金色/橙色） |
| `btn-secondary.png` | 200×60 | 次要按钮（灰色） |
| `btn-danger.png` | 200×60 | 危险按钮（红色） |
| `btn-ready.png` | 150×50 | 准备按钮（绿色） |
| `btn-cancel.png` | 150×50 | 取消按钮 |

**状态：** 每个按钮需要 3 种状态
- 正常状态
- 悬停状态（可选，也可用代码实现）
- 禁用状态

### 2.2 角色标识

| 文件名 | 尺寸 | 说明 |
|--------|------|------|
| `badge-landlord.png` | 60×60 | 地主标识（皇冠/帽子） |
| `badge-farmer.png` | 60×60 | 农民标识（锄头/草帽） |

### 2.3 图标

| 文件名 | 尺寸 | 说明 |
|--------|------|------|
| `icon-coin.png` | 32×32 | 金币图标 |
| `icon-diamond.png` | 32×32 | 钻石图标（可选） |
| `icon-timer.png` | 32×32 | 计时器图标 |
| `icon-speaker.png` | 32×32 | 喇叭图标（快捷消息） |
| `icon-emoji.png` | 32×32 | 表情图标 |

### 2.4 默认头像

| 文件名 | 尺寸 | 说明 |
|--------|------|------|
| `avatar-default.png` | 80×80 | 默认用户头像 |
| `avatar-empty.png` | 80×80 | 空座位占位 |

---

## 3. 背景素材（必需）

### 3.1 牌桌背景

**文件名：** `table-bg.png` 或 `table-bg.jpg`

**规格：**
- 尺寸：**1280×720** 或更大（会自动缩放）
- 格式：PNG 或 JPG
- 设计：绿色绒布/木质牌桌纹理

**颜色建议：**
- 主色：深绿色 `#1a5f3c` 或 `#0d4d2e`
- 可加入细微纹理增加质感

### 3.2 大厅背景（可选）

**文件名：** `lobby-bg.png`

**规格：**
- 尺寸：**1920×1080** 或响应式
- 设计：与牌桌风格统一

---

## 4. 表情素材（P1）

### 4.1 游戏内表情

| 文件名 | 尺寸 | 说明 |
|--------|------|------|
| `emoji-smile.png` | 80×80 | 微笑 |
| `emoji-angry.png` | 80×80 | 生气 |
| `emoji-cry.png` | 80×80 | 哭泣 |
| `emoji-laugh.png` | 80×80 | 大笑 |
| `emoji-cool.png` | 80×80 | 墨镜 |
| `emoji-shock.png` | 80×80 | 惊讶 |

**建议：** 6-10 个表情即可

### 4.2 动态表情（可选）

如需动画效果，可使用：
- GIF 格式
- Sprite Sheet 动画（每帧 80×80，横向排列）

---

## 5. 音效素材（P1）

### 5.1 游戏音效

| 文件名 | 说明 | 时长建议 |
|--------|------|----------|
| `deal.mp3` | 发牌声 | 0.2s |
| `play.mp3` | 出牌声 | 0.3s |
| `pass.mp3` | 不出/跳过 | 0.2s |
| `bomb.mp3` | 炸弹音效 | 0.5s |
| `rocket.mp3` | 王炸音效 | 0.8s |
| `win.mp3` | 胜利音效 | 1-2s |
| `lose.mp3` | 失败音效 | 1-2s |
| `tick.mp3` | 倒计时滴答 | 0.1s |
| `alarm.mp3` | 倒计时紧急 | 0.3s |

### 5.2 UI 音效

| 文件名 | 说明 |
|--------|------|
| `click.mp3` | 按钮点击 |
| `hover.mp3` | 悬停（可选） |
| `card-select.mp3` | 选牌 |
| `message.mp3` | 收到消息 |

### 5.3 音效来源

1. **免费音效网站：**
   - [Freesound](https://freesound.org/) - 搜索 "card", "poker"
   - [Mixkit](https://mixkit.co/free-sound-effects/) - 免费音效
   - [Zapsplat](https://www.zapsplat.com/) - 需注册

2. **格式要求：**
   - 格式：MP3 或 OGG（推荐 MP3）
   - 采样率：44100 Hz
   - 比特率：128-192 kbps

---

## 6. 字体素材（可选）

### 6.1 推荐字体

| 用途 | 推荐字体 | 备选 |
|------|----------|------|
| 中文正文 | 思源黑体 | 微软雅黑 |
| 数字/积分 | Roboto | Arial |
| 游戏标题 | 自定义艺术字 | - |

### 6.2 使用方式

可使用 CSS `@font-face` 或内嵌到图片中

---

## 7. 素材目录结构

```
doudizhu-game/client/public/assets/
├── images/
│   ├── cards/
│   │   ├── cards.png          # 54张牌 Sprite Sheet
│   │   └── card-back.png      # 牌背
│   ├── table/
│   │   └── table-bg.png       # 牌桌背景
│   ├── ui/
│   │   ├── btn-primary.png
│   │   ├── btn-secondary.png
│   │   ├── badge-landlord.png
│   │   ├── badge-farmer.png
│   │   ├── icon-coin.png
│   │   ├── avatar-default.png
│   │   └── ...
│   └── emoji/
│       ├── emoji-smile.png
│       ├── emoji-angry.png
│       └── ...
├── audio/
│   ├── deal.mp3
│   ├── play.mp3
│   ├── bomb.mp3
│   ├── win.mp3
│   ├── lose.mp3
│   └── ...
└── fonts/
    └── ... (可选)
```

---

## 8. 快速开始方案

### 8.1 最小可行素材（MVP）

**阶段一必需（5个文件）：**
1. `cards.png` - 扑克牌 Sprite Sheet
2. `card-back.png` - 牌背
3. `table-bg.png` - 牌桌背景
4. `badge-landlord.png` - 地主标识
5. `badge-farmer.png` - 农民标识

### 8.2 免费素材包推荐

**Kenney 扑克牌素材包：**
- 网址：https://kenney.nl/assets/playing-cards
- 包含完整 54 张牌
- 免费商用

**使用步骤：**
1. 下载素材包
2. 使用 TexturePacker 或 Photoshop 合并为 Sprite Sheet
3. 按照上述布局排列

### 8.3 占位符方案

如果素材未准备好，可使用以下占位符进行开发：
- 使用纯色方块 + 文字代替扑克牌
- 使用 CSS 绘制简易牌面
- 开发完成后替换为正式素材

---

## 9. 素材清单（可打印）

### 必需素材

- [ ] `cards.png` - 扑克牌 Sprite Sheet (1300×560)
- [ ] `card-back.png` - 牌背 (100×140)
- [ ] `table-bg.png` - 牌桌背景 (1280×720)
- [ ] `badge-landlord.png` - 地主标识 (60×60)
- [ ] `badge-farmer.png` - 农民标识 (60×60)
- [ ] `avatar-default.png` - 默认头像 (80×80)

### 按钮素材

- [ ] `btn-primary.png` - 主要按钮
- [ ] `btn-secondary.png` - 次要按钮
- [ ] `btn-ready.png` - 准备按钮

### 图标素材

- [ ] `icon-coin.png` - 金币图标
- [ ] `icon-timer.png` - 计时器图标

### 音效素材

- [ ] `deal.mp3` - 发牌声
- [ ] `play.mp3` - 出牌声
- [ ] `bomb.mp3` - 炸弹音效
- [ ] `win.mp3` - 胜利音效
- [ ] `lose.mp3` - 失败音效

### 表情素材（可选）

- [ ] 6-10 个表情图片

---

## 10. 注意事项

1. **版权问题**：确保使用的素材有合法授权（免费商用或已购买）
2. **文件大小**：图片使用 TinyPNG 压缩，音效控制在合理范围
3. **命名规范**：全部使用小写字母和连字符，如 `card-back.png`
4. **格式统一**：图片统一使用 PNG（需要透明）或 JPG（不需要透明）
