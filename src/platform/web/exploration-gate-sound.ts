// One quiet, optional latch sound, requested only from the successful user gesture.
// No background audio, persistent settings, timers or dependency on Phaser audio.
export function createGateSound(){
  let context:AudioContext|undefined,disposed=false,generation=0;
  let status='idle';
  const hidden=()=>document.visibilityState==='hidden';
  const close=(audio:AudioContext)=>{if(context===audio)context=undefined;void audio.close().catch(()=>{});};
  const stop=()=>{generation++;if(context)close(context);};
  return {
    get status(){return status;},
    async play(){
      if(disposed||hidden())return;
      stop();const request=generation;
      let audio:AudioContext|undefined;
      try{
        if(typeof AudioContext==='undefined'){status='unavailable';return;}
        audio=new AudioContext();context=audio;
        if(audio.state==='suspended')await audio.resume();
        if(disposed||request!==generation||hidden()){close(audio);return;}
        if(audio.state!=='running'){status='unavailable';close(audio);return;}
        const now=audio.currentTime;
        for(let i=0;i<2;i++){
          const oscillator=audio.createOscillator(),gain=audio.createGain(),at=now+i*.09;
          oscillator.type='triangle';oscillator.frequency.setValueAtTime(i?175:280,at);oscillator.frequency.exponentialRampToValueAtTime(85,at+.065);
          gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.035,at+.004);gain.gain.exponentialRampToValueAtTime(.0001,at+.075);
          oscillator.connect(gain);gain.connect(audio.destination);
          oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();if(i===1)close(audio!);};
          oscillator.start(at);oscillator.stop(at+.08);
        }
        status='scheduled';
      }catch{status='unavailable';if(audio)close(audio);}
    },
    stop,
    dispose(){disposed=true;stop();},
  };
}
