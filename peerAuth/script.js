const apikey = window.__SKYWAY_KEY_wPA__;
const Peer = window.Peer;
console.log('API KEY:', apikey);

$('document').ready(async function() {
  const peerId = document.getElementById('myId').value;//$('#myId').value;
  const localVideo = document.getElementById('local-video');
  const remoteVideo = document.getElementById('remote-video');
  const remoteId = document.getElementById('remoteId').value;

  const localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  }).catch(console.error);

  localVideo.muted = true;
  localVideo.srcObject = localStream;
  localVideo.playsInline = true;
  localVideo.play().catch(console.error);
  //const peerId = $('#my-id').value;

  let peer;
  let cCredential;
  $('#get-btn').click(function() {
    console.log('peerId: ', peerId);

$.post('http://localhost:8080/authenticate',
  {
    peerId: peerId,
    sessionToken: '4CXS0f19nvMJBYK05o3toTWtZF5Lfd2t6Ikr2lID'
  }, function(credential) {
    $('#result').text(JSON.stringify(credential, null, 2));
    peer = new Peer('TestPeerID', {
      key: apikey,
      credential: credential
    });

    peer.on('open', id => console.log('PeerOpen(', id, ')'));

    peer.once('call', mediaConnection => {
      mediaConnection.answer(localStream);

      mediaConnection.on('stream', async stream => {
        remoteVideo.srcObject = stream;
        remoteVideo.playsInline = true;
        await remoteVideo.play().catch(console.error);
      });

      mediaConnection.once('close', () => {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
      });

    });

  }).fail(function() {
    alert('Peer Authentication Failed');
  });

  });

  // p2p-call


  $('#call-btn').click(function() {
    if (!peer.open) return;
    const mediaConnection = peer.call(remoteId.value, localStream);

    mediaConnection.on('stream', async stream => {
      // Render remote stream for caller
      remoteVideo.srcObject = stream;
      remoteVideo.playsInline = true;
      await remoteVideo.play().catch(console.error);
    });

    mediaConnection.once('close', () => {
      remoteVideo.srcObject.getTracks().forEach(track => track.stop());
      remoteVideo.srcObject = null;
    });

    closeTrigger.addEventListener('click', () => mediaConnection.close(true));
  });


});

/*
  $('#get-btn').click(function() {
    let gcredential;
    $.post('http://localhost:8080/authenticate',
      {
        peerId: tbx_peerId.value,
        sessionToken: '4CXS0f19nvMJBYK05o3toTWtZF5Lfd2t6Ikr2lID'
      }, function(credential) {
        $('#result').text(JSON.stringify(credential, null, 2));
        gcredential = credential;
      }
    ).fail(function() {
      alert('Peer Authentication Failed');
    });

    // use the credential to create new Peer() here.
    const peer = new Peer(peerId, {
      key: apikey,
      credential: gcredential,
    });

    peer.on('open', function() {
      console.log('peer.open');
    });

    peer.on('expiresin', function(sec) {
      // Create new credential and Update the credential here.
      console.log('the credential is expired in'+sec);
      $.post('http://localhost:8080/authenticate',
        {
          peerId: peerId,
          sessionToken: '4CXS0f19nvMJBYK05o3toTWtZF5Lfd2t6Ikr2lID'
        }, function(credential){
          console.log('Success updating Credential.');
          $('#result').text(JSON.stringify(credential, null, 2));
          peer.updateCredential(credential);
        }
      );
      });


//
      peer.on('error', function(error) {
        // When there is an error and you need to start from the beginning,
        // make sure to get a new credential from the server.
        console.log(`${error.type}: ${error.message}`);
      });
      $('#check-peer').click(function() {
        if(typeof(peer.open) === 'boolean'){
          console.log('peer status:'+peer.open);
        }
      });
    });
  });
*/
