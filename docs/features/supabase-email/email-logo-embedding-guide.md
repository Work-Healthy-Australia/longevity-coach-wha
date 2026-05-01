# Email Logo Embedding Guide

## The Challenge

Email clients have inconsistent support for image embedding. Here's how to handle the logo reliably.

## Option 1: Hosted URL (Recommended for Supabase)

Host the logo on your domain and reference it via absolute URL.

### Pros
- ✅ Works in ALL email clients (including Outlook)
- ✅ Small email size
- ✅ Easy to update (change image once, updates everywhere)
- ✅ Supports SVG, PNG, any format

### Cons
- ⚠️ Requires logo to be publicly accessible
- ⚠️ Some email clients block external images by default (user must click "Show images")

### Implementation

```html
<img src="https://yourdomain.com/janet-cares-logo.png" 
     alt="Longevity Coach" 
     width="48" 
     height="48" 
     style="display:block;margin:0 auto;border-radius:8px;">
```

For Supabase templates, use `{{ .SiteURL }}`:

```html
<img src="{{ .SiteURL }}/janet-cares-logo.png" 
     alt="Longevity Coach" 
     width="48" 
     height="48" 
     style="display:block;margin:0 auto;border-radius:8px;">
```

### Setup Steps

1. **Deploy the logo** to your public folder (e.g., `public/janet-cares-logo.png`)
2. **Verify it's accessible** at `https://yourdomain.com/janet-cares-logo.png`
3. **Update SiteURL in Supabase**: Go to Auth → URL Configuration → Site URL
4. **Paste template** into Supabase Dashboard → Authentication → Email Templates

---

## Option 2: Base64 Data URI

Embed the image directly in the HTML as base64-encoded data.

### Pros
- ✅ Image displays immediately (no external request)
- ✅ Works offline
- ✅ Can't be blocked as "external content"

### Cons
- ❌ **Does NOT work in Outlook** (will show broken image icon)
- ❌ Increases email size significantly (+33% file size)
- ❌ Harder to update (must regenerate all templates)

### Implementation

```html
<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..." 
     alt="Longevity Coach" 
     width="48" 
     height="48" 
     style="display:block;margin:0 auto;border-radius:8px;">
```

### Generate Base64

Run the utility script:

```bash
npx tsx scripts/generate-email-logo-base64.ts
```

Copy the output and paste into your templates.

---

## Option 3: Hybrid Approach (Best of Both)

Use a hosted URL with conditional comments for Outlook.

```html
<!--[if mso]>
<v:rect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{ .SiteURL }}" style="height:48px;width:48px;v-text-anchor:middle;" fillcolor="#2F6F8F">
  <v:fill type="frame" src="{{ .SiteURL }}/janet-cares-logo.png" color="#2F6F8F"/>
  <w:anchorlock/>
  <center style="color:#ffffff;font-family:sans-serif;font-size:13px;font-weight:bold;">Logo</center>
</v:rect>
<![endif]-->
<!--[if !mso]><!-->
<img src="{{ .SiteURL }}/janet-cares-logo.png" 
     alt="Longevity Coach" 
     width="48" 
     height="48" 
     style="display:block;margin:0 auto;border-radius:8px;">
<!--<![endif]-->
```

⚠️ This is complex and usually not necessary. **Option 1 is recommended.**

---

## Recommendation Summary

| Approach | Gmail | Outlook | Apple Mail | Size | Maintenance |
|----------|-------|---------|------------|------|-------------|
| Hosted URL | ✅ | ✅ | ✅ | Small | Easy |
| Base64 | ✅ | ❌ | ✅ | Large | Hard |
| Hybrid | ✅ | ✅ | ✅ | Medium | Complex |

**Use Option 1 (Hosted URL)** for Supabase email templates. It's the most reliable and maintainable approach.

---

## Quick Update Script

To update all templates to use a new logo:

```bash
# 1. Update the logo file in public/
cp new-logo.png public/janet-cares-logo.png

# 2. Update references in templates (if URL changed)
# Templates already use {{ .SiteURL }}/janet-cares-logo.png
# so just deploying the file is enough!
```

If you need to change the filename, update all templates:

```bash
# Mac/Linux
sed -i '' 's/longevity-coach-logo\.png/janet-cares-logo.png/g' supabase/templates/*.html

# Or manually edit each template and update the src attribute
```
