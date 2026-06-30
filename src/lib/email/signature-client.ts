/** Kliento peržiūrai — naudoja viešą logo failą. */
const PREVIEW_LOGO = '/Piksel-Logotipas-juodas-RGB.jpg';

export function stripEmailSignature(body: string): string {
  let trimmed = body.trim();
  const markers = [
    'ryškiai geriau',
    'renatas parojus',
    'renatas pocius',
    'www.piksel.lt',
  ];
  const lower = trimmed.toLowerCase();

  for (const marker of markers) {
    const index = lower.indexOf(marker);
    if (index > 0) {
      trimmed = trimmed.slice(0, index).trimEnd();
      break;
    }
  }

  return trimmed.replace(/\n{3,}/g, '\n\n').trim();
}

export function getSignatureHtml(): string {
  return `<div style="margin-left:0px;">&nbsp;</div>
<div style="margin-left:0px;">
  <font style="color:#000000;font-family:Arial, sans-serif;">-Ryškiai geriau-</font><br><br>
  <font style="color:#000000;">Renatas Parojus</font>
</div>
<div style="margin-left:0px;">
  <font style="color:#000000;">T. 370 690 666 33</font>
</div>
<div style="margin-left:0px;">
  <font style="color:#000000;">W. </font><a href="https://www.piksel.lt"><font style="color:#000000;">www.piksel.lt</font></a>
</div>
<div style="margin-left:0px;">&nbsp;</div>
<div style="margin-left:0px;"><img src="${PREVIEW_LOGO}" alt="Piksel" width="120" style="width:120px;max-width:120px;height:auto;margin:0.7em 0;display:block;border:0;"><br>&nbsp;</div>`;
}
