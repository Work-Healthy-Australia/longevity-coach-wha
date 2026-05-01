# Supabase Email Templates

Branded HTML email templates for Supabase Auth that match the Longevity Coach design system.

## Templates Included

### Authentication Flows

| Template | Purpose | Variables |
|----------|---------|-----------|
| `confirmation.html` | Email verification after signup | `{{ .ConfirmationURL }}`, `{{ .SiteURL }}` |
| `recovery.html` | Password reset request | `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .SiteURL }}` |
| `magic_link.html` | Passwordless sign-in | `{{ .ConfirmationURL }}`, `{{ .SiteURL }}` |
| `invite.html` | User invitation | `{{ .ConfirmationURL }}`, `{{ .SiteURL }}` |
| `email_change.html` | Email address change verification | `{{ .ConfirmationURL }}`, `{{ .NewEmail }}`, `{{ .SiteURL }}` |
| `reauthentication.html` | 6-digit OTP for sensitive operations | `{{ .Token }}`, `{{ .SiteURL }}` |

### Security Notifications

| Template | Purpose | Variables |
|----------|---------|-----------|
| `password_changed_notification.html` | Confirm password change | `{{ .Email }}`, `{{ .SiteURL }}` |
| `email_changed_notification.html` | Confirm email change | `{{ .Email }}`, `{{ .OldEmail }}`, `{{ .SiteURL }}` |
| `mfa_factor_enrolled_notification.html` | MFA added alert | `{{ .FactorType }}`, `{{ .SiteURL }}` |
| `mfa_factor_unenrolled_notification.html` | MFA removed alert | `{{ .FactorType }}`, `{{ .SiteURL }}` |
| `identity_linked_notification.html` | Social login linked | `{{ .Provider }}`, `{{ .SiteURL }}` |
| `identity_unlinked_notification.html` | Social login unlinked | `{{ .Provider }}`, `{{ .SiteURL }}` |

## Design System Reference

### Colors
- **Primary**: `#2F6F8F` (teal blue - CTAs, links)
- **Primary 700**: `#245672` (hover states)
- **Sage**: `#6B8E83` (secondary accent)
- **Success**: `#2A7A5C` (positive states)
- **Warning**: `#B5722F` (attention states)
- **Danger**: `#B5452F` (error states)
- **Ink**: `#2B2B2B` (primary text)
- **Ink Soft**: `#4B4B4B` (secondary text)
- **Grey**: `#8A9AA5` (tertiary text)
- **Line**: `#E3E8EC` (borders)
- **Surface**: `#FFFFFF` (card background)
- **Canvas**: `#F4F7F9` (page background)

### Typography
- **Headings**: Georgia, serif (400 weight, 26px)
- **Body**: 'Helvetica Neue', Arial, sans-serif (15px, 1.6 line-height)
- **Small text**: 13px for metadata, 12px for footer

### Layout
- **Container max-width**: 520px
- **Card border-radius**: 16px
- **Button border-radius**: 8px
- **Alert border-left**: 4px solid accent color

## Usage

### Local Development

1. Copy the relevant sections from `config.example.toml` to your `supabase/config.toml`
2. Restart Supabase: `supabase stop && supabase start`

### Hosted Supabase (Dashboard)

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Email Templates**
3. Copy the HTML content from each template file
4. Paste into the corresponding template section in the dashboard

### Important Notes

- Templates use `{{ .VariableName }}` syntax for Go template variables
- The logo reference uses `{{ .SiteURL }}/longevity-coach-logo.png` — ensure this path is correct for your deployment
- All templates use table-based layouts for maximum email client compatibility
- Inline CSS is used throughout for broad email client support

## Preview

To preview templates locally, you can open them directly in a browser. Note that some email-specific rendering may differ from browser preview.

## Customization

To adjust the templates:

1. **Logo**: Update the `<img>` src in each template to point to your hosted logo
2. **Colors**: Modify the hex values in the inline styles
3. **Copy**: Edit the text content while preserving the `{{ .Variable }}` placeholders
4. **CTA buttons**: Adjust the `padding`, `border-radius`, and `background` styles
