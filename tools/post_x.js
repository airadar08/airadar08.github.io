// Paste into ONE javascript_exec on an x.com tab, after defining:
//   const HTML = <JSON string of the *.baked.html file>;  const TEXT = <JSON string of the post text>;
// Renders the card to PNG in the page, opens the composer, attaches the image, pastes the text.
// Returns checks; it does NOT click Post.
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><foreignObject width="1080" height="1350">${HTML}</foreignObject></svg>`;
const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await img.decode();
const c=document.createElement('canvas');c.width=1080;c.height=1350;c.getContext('2d').drawImage(img,0,0);
const blob=await new Promise(r=>c.toBlob(r,'image/png'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
if(!document.querySelector('[data-testid="tweetTextarea_0"]')){document.querySelector('[data-testid="SideNav_NewTweet_Button"]').click();await sleep(1500);}
const inp=document.querySelector('input[data-testid="fileInput"]');const dt=new DataTransfer();dt.items.add(new File([blob],'card.png',{type:'image/png'}));inp.files=dt.files;inp.dispatchEvent(new Event('change',{bubbles:true}));
await sleep(2500);
const ta=document.querySelector('[data-testid="tweetTextarea_0"]');ta.focus();const d2=new DataTransfer();d2.setData('text/plain',TEXT);ta.dispatchEvent(new ClipboardEvent('paste',{clipboardData:d2,bubbles:true,cancelable:true}));
await sleep(1500);
({blob:blob.size,composer:ta.innerText.slice(0,80),attach:!!document.querySelector('[data-testid="attachments"]'),btn:[...document.querySelectorAll('[data-testid^="tweetButton"]')].map(b=>b.getAttribute('data-testid')+':'+b.getAttribute('aria-disabled'))})
