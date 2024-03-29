const Peer = window.Peer;

(async function main() {
  const localVideo = document.getElementById('js-local-stream');
  const textMyPId = document.getElementById('js-myPId');
  const joinTrigger = document.getElementById('js-join-trigger');
  const leaveTrigger = document.getElementById('js-leave-trigger');
  const remoteVideos = document.getElementById('js-remote-streams');
  const roomId = document.getElementById('js-room-id');
  const roomMode = document.getElementById('js-room-mode');
  const localText = document.getElementById('js-local-text');
  const sendTrigger = document.getElementById('js-send-trigger');
  const messages = document.getElementById('js-messages');
  const meta = document.getElementById('js-meta');
  const sdkSrc = document.querySelector('script[src*=skyway]');
  const ECFlag = document.getElementById('js-EC-flag');
  const NSFlag = document.getElementById('js-NS-flag');
  const dlArea = document.getElementById('js-downloadButton-area');

  meta.innerText = `
    UA: ${navigator.userAgent}
    SDK: ${sdkSrc ? sdkSrc.src : 'unknown'}
  `.trim();

  const getRoomModeByHash = () => (location.hash === '#sfu' ? 'sfu' : 'mesh');

  roomMode.textContent = getRoomModeByHash();
  window.addEventListener(
    'hashchange',
    () => (roomMode.textContent = getRoomModeByHash())
  );

  const localStream = await navigator.mediaDevices
    .getUserMedia({
      audio: {
        echoCancellation: ECFlag.checked,
        noiseSuppression: NSFlag.checked,
      },
      video: true,
    })
    .catch(console.error);

  const localStream4Rec = localStream.clone();

  ECFlag.addEventListener('change', () =>{
    const audioTrack = localStream.getAudioTracks()[0];
    const constraints = audioTrack.getConstraints();
    constraints.echoCancellation = ECFlag.checked;
    audioTrack.applyConstraints(constraints)
    .then( () => {
      console.log('Constraints:', audioTrack.getConstraints());
    })
    .catch( err => {
      console.log('error Changing Constraints:', e);
    });
  });

  NSFlag.addEventListener('change', () =>{
    const audioTrack = localStream.getAudioTracks()[0];
    const constraints = audioTrack.getConstraints();
    constraints.noiseSuppression = NSFlag.checked;
    audioTrack.applyConstraints(constraints)
    .then( () => {
      console.log('Constraints:', audioTrack.getConstraints());
    })
    .catch( err => {
      console.log('error Changing Constraints:', e);
    });
  });


  // Render local stream
  localVideo.muted = true;
  localVideo.srcObject = localStream;
  localVideo.playsInline = true;
  await localVideo.play().catch(console.error);

  // eslint-disable-next-line require-atomic-updates
  const peer = (window.peer = new Peer({
    key: window.__SKYWAY_KEY__,
    debug: 3,
  }));

  peer.once('open', () => textMyPId.textContent = peer.id);

  //MediaStream Recording with Browser API
  class Recorder{
//  async function startRecording(stream){
    constructor(stream, peerId){
      this.blobs = [];
      this.mediaRecorder = new MediaRecorder(stream);
      this.id = peerId;
      
      this.mediaRecorder.ondataavailable = (event) => {
        if(event.data && event.data.size > 0){
          this.blobs.push(event.data);
      }}
      
      this.mediaRecorder.onstop = (event) => {
        console.log("stop Recording", this.id);
        console.log("start Downloading", this.id);
        this.download(stream, this.id);
      }

      this.mediaRecorder.start();
      console.log('Start Recording ', this.id);
    }

    stop(){
      if(this.mediaRecorder.state == 'recording') this.mediaRecorder.stop();
    }

    download(stream, fname){
      const downloadBlob= new Blob(this.blobs, {type: 'video/VP8'});
      const url = window.URL.createObjectURL(downloadBlob);
      const a = document.createElement('a');
      a.style.display = 'block';
      a.href = url;
      a.download = `${fname}.webm`;
      a.textContent = this.id;
      dlArea.appendChild(a);
      /*
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
      */
    }
  }

  // Register join handler
  joinTrigger.addEventListener('click', () => {
    // Note that you need to ensure the peer has connected to signaling server
    // before using methods of peer instance.
    if (!peer.open) {
      return;
    }

    const localRecorder = new Recorder(localStream4Rec, peer.id);
    const remoteRecorder = [];

    const room = peer.joinRoom(roomId.value, {
      mode: getRoomModeByHash(),
      stream: localStream,
      videoCodec: 'VP8',
    });

    room.once('open', () => {
      messages.textContent += '=== You joined ===\n';
    });
    room.on('peerJoin', peerId => {
      messages.textContent += `=== ${peerId} joined ===\n`;
    });

    // Render remote stream for new peer join in the room
    room.on('stream', async stream => {
      const remoteStream4Rec = new MediaStream(stream.getAudioTracks());

      const container = document.createElement('div');
      // mark peerId to find it later at peerLeave event
      container.setAttribute('data-peer-id', stream.peerId);
      remoteVideos.append(container);

      // create a <Video> Object to play remote Video
      const newVideo = document.createElement('video');
      newVideo.srcObject = stream;
      newVideo.playsInline = true;
      container.append(newVideo);
      await newVideo.play().catch(console.error);

      // create a <label> Object to appear the peerId
      const text_pId = document.createElement('label');
      text_pId.textContent = stream.peerId;
      container.append(text_pId);

      // create Recorder for the new Remote Stream
      remoteRecorder.push({
        peerId: stream.peerId,
        recorder: new Recorder(remoteStream4Rec, stream.peerId),
      });

    });

    room.on('data', ({ data, src }) => {
      // Show a message sent to the room and who sent
      messages.textContent += `${src}: ${data}\n`;
    });

    // for closing room members
    room.on('peerLeave', peerId => {
      // Stop Remote Recorder
      remoteRecorder.forEach( object => {
        if(object.peerId == peerId) object.recorder.stop();
      });

      // remove Video object
      const remoteObjects = remoteVideos.querySelector(
        `[data-peer-id="${peerId}"]`
      );

      Array.from(remoteObjects.children).forEach( item => {
        if(item.nodeName == 'VIDEO'){
          item.srcObject.getTracks().forEach(track => track.stop());
          item.srcObject = null;
        }
        item.remove();
      });

      remoteObjects.remove();

      messages.textContent += `=== ${peerId} left ===\n`;
    });

    // for closing myself
    room.once('close', () => {
      remoteRecorder.forEach( object => {
        object.recorder.stop();
      });

      sendTrigger.removeEventListener('click', onClickSend);
      messages.textContent += '== You left ===\n';
      Array.from(remoteVideos.children).forEach(containers => {
        Array.from(containers.children).forEach( item => {
          if(item.nodeName == 'VIDEO'){
            item.srcObject.getTracks().forEach(track => track.stop());
            item.srcObject = null;
          }
          item.remove();
        });
      });
    });

    sendTrigger.addEventListener('click', onClickSend);
    leaveTrigger.addEventListener('click', () => {
      localRecorder.stop();//mediaRecorder.stop();

      room.close();
      }
    , { once: true });

    function onClickSend() {
      // Send message to all of the peers in the room via websocket
      room.send(localText.value);

      messages.textContent += `${peer.id}: ${localText.value}\n`;
      localText.value = '';
    }
  });

  peer.on('error', console.error);
})();

