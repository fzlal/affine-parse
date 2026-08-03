# affine-parse

[English](README.md)

تبدیل فایل‌های پشتیبان `.affine` به Markdown و بالعکس.

## پیش‌نیازها

- [Bun](https://bun.sh) نسخه 1.0 یا بالاتر

## نصب

```bash
git clone https://github.com/fzlal/affine-parse.git
cd affine-parse
bun install
```

## نحوه استفاده

### خروجی: .affine → Markdown

```bash
bun run export <مسیر فایل .affine> [پوشه خروجی]
```

```bash
bun run export ./workspace.affine ./output
```

### ورودی: Markdown → .affine

```bash
bun run import <پوشه ورودی> <مسیر خروجی.affine>
```

```bash
bun run import ./my-docs ./workspace.affine
```

### کامپایل به فایل اجرایی

```bash
bun run build
./affine-parse export ./workspace.affine ./output
./affine-parse import ./my-docs ./workspace.affine
```

## ساختار خروجی

```
output/
└── <نام ورک‌اسپیس>/
    ├── index.md                  # فهرست کل اسناد
    ├── <نام پوشه>/               # پوشه‌های اصلی
    │   └── <سند>.md
    ├── public/                   # اسناد بدون پوشه
    │   └── <سند>.md
    ├── templates/                # قالب‌ها
    │   └── <سند>.md
    └── trash/                    # اسناد حذف‌شده
        └── <سند>.md
```

## ساختار ورودی

```
my-docs/
├── page1.md                     # هر فایل .md یک صفحه می‌شود
├── page2.md
└── subfolder/
    ├── page3.md                 # پوشه‌ها به عنوان پیشوند عنوان
    └── image.png                # عکس‌ها به عنوان blob وارد می‌شوند
```

## پشتیبانی

| ویژگی | خروجی | ورودی |
|-------|-------|-------|
| تیترها (h1-h6) | ✅ | ✅ |
| bold, italic, strike | ✅ | ✅ |
| کد بلاک | ✅ | ✅ |
| لیست گلوله‌ای | ✅ | ✅ |
| لیست شماره‌دار | ✅ | ✅ |
| todo list | ✅ | ✅ |
| نقل‌قول | ✅ | ✅ |
| جداکننده | ✅ | ✅ |
| تصاویر (blob) | ✅ | ✅ |
| لینک‌ها | ✅ | ✅ |
| جدول | ✅ | ✅ |
| LaTeX | ✅ | ✅ |
| بوکمارک | ✅ | ✅ |
| ساختار پوشه | ✅ | از طریق پیشوند عنوان |
| قالب‌ها | ✅ | از نام پوشه |

## نحوه کار

### خروجی

فایل `.affine` یک پایگاه‌داده SQLite با داده‌های Yjs CRDT binary است. این ابزار فایل SQLite را مستقیماً می‌خواند — نیازی به اجرای AFFiNE نیست.

### ورودی

فایل‌های Markdown با [remark](https://github.com/remarkjs/remark) پارس شده و به بلاک‌های AFFiNE تبدیل می‌شوند. فایل خروجی فرمت v2 را رعایت کرده و قابل وارد کردن در AFFiNE است.

## لایسنس

MIT
