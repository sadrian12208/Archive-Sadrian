export default function handler(req, res) {
    const { id, title, text, image } = req.query;

    if (!id) {
        return res.redirect(301, '/');
    }

    const postUrl = `https://archive-sadrian.vercel.app/?post=${id}`;
    const displayTitle = title || 'Archive Sadrian';
    const displayText = text || 'Check out this archive post!';
    const displayImage = image || 'https://archive-sadrian.vercel.app/icon.png';

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>${displayTitle}</title>
            <meta property="og:title" content="${displayTitle}">
            <meta property="og:description" content="${displayText}">
            <meta property="og:image" content="${displayImage}">
            <meta property="og:url" content="${postUrl}">
            <meta property="og:type" content="article">
            
            <meta name="twitter:card" content="summary_large_image">
            <meta name="twitter:title" content="${displayTitle}">
            <meta name="twitter:description" content="${displayText}">
            <meta name="twitter:image" content="${displayImage}">

            <meta http-equiv="refresh" content="0; url=${postUrl}">
            <script>window.location.href = "${postUrl}";</script>
        </head>
        <body>
            <p>Redirecting to post...</p>
        </body>
        </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
}
