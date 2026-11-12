(() => {
  if (window.__adshareInstalled) return;
  window.__adshareInstalled = true;
  let card = null, currentAd = null, visibleTimer = null, lastGeneration = false, lastFetch = 0;
  const id = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
  const send = (path, method='GET', body) => new Promise(resolve => chrome.runtime.sendMessage({ type:'ADSHARE_API', path, method, body }, resolve));
  const selectors = {
    chatgpt: ['[data-message-author-role="assistant"]', 'button[data-testid="send-button"]', 'button[data-testid="stop-button"]'],
    gemini: ['message-content', 'button[aria-label*="Stop"]', 'button[aria-label*="Send"]'],
    claude: ['[data-testid="chat-message"]', 'button[aria-label*="Stop"]', 'button[aria-label*="Send"]']
  };
  const platform = location.hostname.includes('gemini') ? 'gemini' : location.hostname.includes('claude') ? 'claude' : 'chatgpt';
  const isGenerating = () => {
    const stop = platform==='chatgpt' ? document.querySelector('button[data-testid="stop-button"]') :
      platform==='gemini' ? document.querySelector('button[aria-label*="Stop"]') : document.querySelector('button[aria-label*="Stop"]');
    const busy = document.querySelector('[aria-busy="true"], .result-streaming, [data-is-streaming="true"]');
    return !!(stop || busy);
  };
  function removeCard(){ if(visibleTimer)clearTimeout(visibleTimer);visibleTimer=null;if(card)card.remove();card=null;currentAd=null; }
  async function fetchAd(){
    const t=Date.now();if(t-lastFetch<12000)return;lastFetch=t;
    const result=await send('/api/ads/next');if(!result?.ok||!result.data?.ad)return;
    currentAd=result.data.ad;render(currentAd);
  }
  function render(ad){
    removeCard();currentAd=ad;card=document.createElement('aside');card.className='adshare-card';card.setAttribute('aria-label','Sponsored content');
    const header=document.createElement('div');header.className='adshare-head';header.innerHTML='<span>AdShare</span><span class="adshare-sponsored">Sponsored</span><button class="adshare-close" aria-label="Close ad">×</button>';
    header.querySelector('button').addEventListener('click',removeCard);card.append(header);
    const content=document.createElement('div');content.className='adshare-content';
    const titleLink=document.createElement('a');titleLink.href=ad.clickUrl;titleLink.target='_blank';titleLink.rel='noopener noreferrer sponsored';titleLink.className='adshare-title';titleLink.textContent=ad.title;content.append(titleLink);
    if(ad.type==='image') {const img=document.createElement('img');img.src=ad.mediaUrl;img.alt=ad.title;img.loading='lazy';const imageLink=document.createElement('a');imageLink.href=ad.clickUrl;imageLink.target='_blank';imageLink.rel='noopener noreferrer sponsored';imageLink.className='adshare-media-link';imageLink.append(img);content.append(imageLink);}
    if(ad.type==='video') {const video=document.createElement('video');video.src=ad.mediaUrl;video.controls=true;video.muted=true;video.playsInline=true;video.preload='metadata';content.append(video);}
    if(ad.body){const p=document.createElement('p');p.textContent=ad.body;content.append(p);}
    const link=document.createElement('a');link.href=ad.clickUrl;link.target='_blank';link.rel='noopener noreferrer sponsored';link.textContent=ad.type==='video'?'Watch video / Learn more':'Learn more';content.append(link);card.append(content);
    const footer=document.createElement('div');footer.className='adshare-foot';footer.textContent='You may earn a reward for a verified view.';card.append(footer);
    document.body.append(card);
    visibleTimer=setTimeout(async()=>{
      if(!card||!document.contains(card)||!currentAd)return;
      const result=await send('/api/ads/impression','POST',{campaignId:ad.campaignId,impressionKey:id(),visibleMs:2500});
      if(result?.ok){footer.textContent=`Verified view · ₹${Number(result.data.reward).toFixed(2)} earned`;}
      else {footer.textContent='Sponsored · View not eligible for reward';}
    },2500);
  }
  const observer=new MutationObserver(()=>{
    const generating=isGenerating();
    if(generating&&!lastGeneration) fetchAd();
    if(!generating&&lastGeneration) setTimeout(()=>{if(!isGenerating())removeCard();},2500);
    lastGeneration=generating;
    if(card&&!document.contains(card))removeCard();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-busy','data-is-streaming']});
  // Fallback for sites whose streaming controls are not exposed through stable selectors.
  setInterval(()=>{const generating=isGenerating();if(generating&&!lastGeneration)fetchAd();if(!generating&&lastGeneration)removeCard();lastGeneration=generating;},1800);
})();
