### Change scale

```html
<script>
  (function () {
    try {
      var ua = navigator.userAgent || '';
      var platform = navigator.platform || '';
      // Robust mobile detection (incl. iPadOS desktop UA)
      var isMobile = (navigator.userAgentData && navigator.userAgentData.mobile) ||
        /Android|webOS|iPhone|iPod|iPad|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(ua) ||
        ((/Macintosh|MacIntel/.test(platform || ua)) && (navigator.maxTouchPoints || 0) > 1);
      var scale = isMobile ? 0.70 : 1;
      var meta = document.querySelector('meta[name="viewport"]');
      if (meta) {
        var content = 'width=device-width, initial-scale=' + scale + ', viewport-fit=cover';
        meta.setAttribute('content', content);
      }
    } catch (e) { }
  })();
</script>
``` 