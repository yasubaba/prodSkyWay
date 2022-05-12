//const Peer = window.Peer;
let peer;

(async function main() {
  const localVideo = document.getElementById('js-local-stream');
  const joinTrigger = document.getElementById('js-join-trigger');
  const leaveTrigger = document.getElementById('js-leave-trigger');
  const remoteVideos = document.getElementById('js-remote-streams');
  const roomId = document.getElementById('js-room-id');
  //const roomMode = document.getElementById('js-room-mode');
  const localText = document.getElementById('js-local-text');
  const sendTrigger = document.getElementById('js-send-trigger');
  const messages = document.getElementById('js-messages');
  const meta = document.getElementById('js-meta');
  const sdkSrc = document.querySelector('script[src*=skyway]');

  meta.innerText = `
    UA: ${navigator.userAgent}
    SDK: ${sdkSrc ? sdkSrc.src : 'unknown'}
  `.trim();

  const getRoomModeByHash = () => (location.hash === '#sfu' ? 'sfu' : 'mesh');

/*  roomMode.textContent = getRoomModeByHash();
  window.addEventListener(
    'hashchange',
    () => (roomMode.textContent = getRoomModeByHash())
  );*/

  const localStream = await navigator.mediaDevices
    .getUserMedia({
      audio: true,
      video: true,
    })
    .catch(console.error);

  // Render local stream
  localVideo.muted = true;
  localVideo.srcObject = localStream;
  localVideo.playsInline = true;
  await localVideo.play().catch(console.error);

  // eslint-disable-next-line require-atomic-updates
  peer = ( window.peer = new Peer({
    key: window.__SKYWAY_KEY__,
    debug: 3,
  }));

  // Register join handler
  joinTrigger.addEventListener('click', joinRoom);

  function joinRoom(){
    // Note that you need to ensure the peer has connected to signaling server
    // before using methods of peer instance.
    if (!peer.open) {
      console.error('Peer is not Opend');
      return;
    }

    const room = peer.joinRoom(roomId.value, {
      mode: 'sfu',
      stream: localStream,
    });

    room.once('open', () => {
      messages.textContent += '=== You joined ===\n';
    });
    room.on('peerJoin', peerId => {
      messages.textContent += `=== ${peerId} joined ===\n`;
    });

    // Render remote stream for new peer join in the room
    room.on('stream', async stream => {
      const newVideo = document.createElement('video');
      newVideo.srcObject = stream;
      newVideo.playsInline = true;
      // mark peerId to find it later at peerLeave event
      newVideo.setAttribute('data-peer-id', stream.peerId);
      remoteVideos.append(newVideo);
      await newVideo.play().catch(console.error);
    });

    room.on('data', ({ data, src }) => {
      // Show a message sent to the room and who sent
      messages.textContent += `${src}: ${data}\n`;
    });

    // for closing room members
    room.on('peerLeave', peerId => {
      const remoteVideo = remoteVideos.querySelector(
        `[data-peer-id="${peerId}"]`
      );
      remoteVideo.srcObject.getTracks().forEach(track => track.stop());
      remoteVideo.srcObject = null;
      remoteVideo.remove();

      messages.textContent += `=== ${peerId} left ===\n`;
    });

    // for closing myself
    room.once('close', () => {
      console.log('close room Connection');
      sendTrigger.removeEventListener('click', onClickSend);
      messages.textContent += '== You left ===\n';
      Array.from(remoteVideos.children).forEach(remoteVideo => {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
        remoteVideo.remove();
      });
    });


    // Try getting a PeerConnection
    function getPC(){
      return new Promise(resolve => {
        const Interval_getPC = setInterval( () => {
          console.log('Getting PeerConnection.');
          if(room.getPeerConnection()){
            console.log('Got PeerConnection.');
            clearInterval(Interval_getPC);
            resolve(room.getPeerConnection());
          }
        }, 1000);
      });
    }

    // Try connecting to a diapatcher to check connectivity to SkyWay 
    function chkDispatcherAccess(){
      return new Promise( (resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.open("GET", "https://dispatcher.webrtc.ecl.ntt.com/signaling");
        xhr.send();

        xhr.onload = () => {
          console.log(xhr.response);
          resolve();
        };

        xhr.onerror = () => {
          reject("Network Error.");
        };
      });
    }

    // Monitor the connection state after getting PeerConnection object.
    getPC().then( pc => {
      console.log('iceConnectionState:', pc.iceConnectionState);
      console.log('ConnectionState:', pc.connectionState);
      let currentIceCS = pc.iceConnectionState;
      let currentPeerCS = pc.connectionState;
      pc.addEventListener('iceconnectionstatechange', chkDisconnected);
      pc.addEventListener('connectionstatechange', loggingConnectionState);

      function chkDisconnected(){
        const iceCS = pc.iceConnectionState;
        console.log('iceConnectionState: ', currentIceCS, '->', iceCS);
        currentIceCS = pc.iceConnectionState;

        if(iceCS == 'disconnected'){
          let chkCount = 0;
          const Interval_cDA = setInterval( () => {
            console.log('Check Connectivity to SkyWay.');
            chkCount++;
            chkDispatcherAccess().then( () => {
                console.log('Succeed to connect SkyWay.');
                clearInterval(Interval_cDA);
                setTimeout( () => {
                  if(pc.iceConnectionState != 'connected' && pc.iceConnectionState != 'completed'){
                    pc.removeEventListener('iceconnectionstatechange', chkDisconnected);
                    pc.removeEventListener('connectionstatechange', loggingConnectionState);
                    /*
                    if(room){
                      room.close();
                      //room = null;
                    }
                    if(peer.open){
                      peer.destroy();
                      peer = null;
                    }
                    rejoinRoom();
                    */
                    console.log('restart Ice');
                    pc.restartIce();
                  }
                }, 100);
            }).catch();
            if( chkCount > 60) clearInterval(Interval_cDA);
          }, 1000);
        }
      }
      function loggingConnectionState(){
        const peerCS = pc.connectionState;
        console.log('peerConnectionState: ', currentPeerCS, '->', peerCS);
        currentPeerCS = pc.connectionState;
      }
    }).catch( err => console.error(err) );

    sendTrigger.addEventListener('click', onClickSend);
    leaveTrigger.addEventListener('click', () => room.close(), { once: true });

    function onClickSend() {
      // Send message to all of the peers in the room via websocket
      room.send(localText.value);

      messages.textContent += `${peer.id}: ${localText.value}\n`;
      localText.value = '';
    }
  }


  function rejoinRoom(){
    const waitTime = Math.floor(Math.random() * 1000);
    setTimeout( () => {
      peer = ( window.peer = new Peer({
        key: window.__SKYWAY_KEY__,
        debug: 3,
      }));
    }, waitTime);

    Interval_newPeer = setInterval( () => {
      if(peer.open){
        clearInterval(Interval_newPeer);
        joinRoom();
      }
    }, 100);
  }


  peer.on('error', (error) => {
    console.error;
    console.log(error.type);
  });
  peer.on('close', () => {
    console.error('close Peer');
  });
})();
