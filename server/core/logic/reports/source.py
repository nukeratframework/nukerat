report_styles = """
@page { size: A4; margin: 2cm; }
body {
  font-family: Helvetica, Arial, sans-serif;
  color: #1a1a1a;
  font-size: 11pt;
  background: #e7e7e7;
  padding: 15px;
}
h1 {
  font-size: 22pt;
  margin: 0 0 6pt;
  color: #111;
}
h2 {
  font-size: 14pt;
  margin: 18pt 0 8pt;
  color: #222;
  border-bottom: 1px solid #ccc;
  padding-bottom: 4pt;
}
.meta {
  color: #555;
  font-size: 10pt;
  margin-bottom: 16pt;
}
.desc {
  margin-bottom: 9pt;
  color: #333;
}
.desc + h2 {
  margin-top: 4rem;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8pt;
}
th,
td {
  border: 1px solid #ddd;
  padding: 6pt 8pt;
  text-align: left;
  vertical-align: top;
}
th {
  background: #f3f3f3;
  font-size: 9pt;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
td {
  font-size: 10pt;
}
.mono {
  font-family: Courier, monospace;
  font-size: 9pt;
  white-space: pre-wrap;
  word-break: break-word;
}
.badge {
  display: inline-block;
  background: #eee;
  border-radius: 4pt;
  padding: 2pt 6pt;
  margin: 2pt;
  font-size: 9pt;
}
.whitespace-nowrap {
  white-space: nowrap;
}
"""

report_html_base = """<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>{styles}</style>
  </head>
  <body>
    <h1>{title}</h1>
    <div class="meta">{subtitle}</div>
    <div class="desc">{description}</div>
    {body}
  </body>
</html>
"""


def format_report_html(title: str, subtitle: str, description: str, body: str) -> str:
    # Fills the report html template
    return report_html_base.format(
        styles=report_styles.strip(),
        title=title,
        subtitle=subtitle,
        description=description,
        body=body,
    )
