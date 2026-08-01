# affine-parse

[English](README.md)

تبدیل فایل‌های پشتیبان `.affine` به مجموعه فایل‌های Markdown ساختاریافته.

## پیش‌نیازها

- [Bun](https://bun.sh) نسخه 1.0 یا بالاتر

## نصب

```bash
git clone https://github.com/fzlal/affine-parse.git
cd affine-parse
bun install
```

## نحوه استفاده

```bash
bun run start <مسیر فایل .affine> <پوشه خروجی>
```

### مثال

```bash
bun run start ./workspace.affine ./output
```

### کامپایل به فایل اجرایی

```bash
bun run build
./affine-parse ./workspace.affine ./output
```

## ساختار خروجی

```
output/
└── <نام ورک‌اسپیس>/
    ├── index.md                  # فهرست کل اسناد با لینک
    ├── <نام پوشه>/               # پوشه‌های اصلی
    │   ├── <زیرپوشه>/
    │   │   └── <سند>.md
    │   └── <سند>.md
    ├── public/                   # اسناد بدون پوشه
    │   └── <سند>.md
    ├── templates/                # قالب‌ها
    │   └── <سند>.md
    └── trash/                    # اسناد حذف‌شده
        └── <سند>.md
```

### دسته‌بندی خروجی

| پوشه | توضیح |
|------|-------|
| `<نام پوشه>/` | اسناد مرتب‌شده طبق ساختار پوشه‌های اصلی |
| `public/` | اسنادی که در هیچ پوشه‌ای قرار ندارند |
| `templates/` | قالب‌ها (شامل `isTemplate: true`) |
| `trash/` | اسناد حذف‌شده (شامل `trash: true`) |

## پشتیبانی

- **متن غنی**: bold, italic, strikethrough, inline code
- **تیترها**: h1 تا h6
- **لیست‌ها**: شماره‌دار، گلوله‌ای، todo list
- **کد بلاک**: با زبان و کپشن
- **تصاویر**: با لینک blob
- **لینک‌ها**: داخلی و خارجی
- **جدول**: ساده
- **LaTeX**: ریاضی
- **جداکننده**: خط افقی
- **نقل‌قول**: blockquote
- **بوکمارک**: لینک خارجی
- **YouTube**: embed
- **ساختار پوشه**: از `db$folders`
- **قالب‌ها**: از `db$docProperties`

## نحوه کار

فایل `.affine` یک پایگاه‌داده SQLite است که محتوای اسناد به صورت Yjs CRDT binary ذخیره شده است. این ابزار فایل SQLite را مستقیماً می‌خواند و داده‌های Yjs binary را دیکد می‌کند — نیازی به اجرای AFFiNE نیست.

## لایسنس

MIT
