const fs = require("fs");
const path = require("path");
const Metalsmith = require("metalsmith");
const markdown = require("metalsmith-markdown");
const layouts = require("metalsmith-layouts");
const inplace = require("metalsmith-in-place");
const permalinks = require("metalsmith-permalinks");
const collections = require("metalsmith-collections");
const metadata = require("metalsmith-metadata");
const nunjucks = require("nunjucks");
const paths = require("metalsmith-paths");
const less = require("metalsmith-less");
const autoprefixer = require("metalsmith-autoprefixer");
const metacopy = require("metalsmith-metacopy");
const pagination = require("metalsmith-pagination");
const jsonToFiles = require("metalsmith-json-to-files");
const htmlMinifier = require("metalsmith-html-minifier");
const filesize = require("filesize");
const watch = require("metalsmith-watch");
// const nunjucks = require('jstransformer')(require('jstransformer-nunjucks'))
let lumvids;

if (fs.existsSync("./lumvids.json")) {
  lumvids = require("./lumvids.json");
  console.log(lumvids);
  let fandoms = [];

  for (key in lumvids) {
    const vid = lumvids[key];
    // console.log(vid.fandoms, typeof vid.fandoms);
    Array.prototype.forEach.call(vid.fandoms || [], fandom => {
      if (fandoms.indexOf(fandom) === -1) {
        fandoms.push(fandom);
      }
    });
  }

  fandoms.sort();
  fs.writeFileSync("./src/data/fandoms.json", JSON.stringify(fandoms));

  let files = fs
    .readdirSync("F:\\lum\\encodes")
    .filter(f => f.indexOf(".m4v") > -1);
  let vids = Object.keys(lumvids).map(v => {
    const vid = lumvids[v];
    let mp4 = files.filter(f => f.indexOf(`-${v.split("-")[0]}-`) > -1);
    let mp4size = 0;
    if (mp4.length) {
      mp4size = fs.statSync(path.join("F:\\lum\\encodes", mp4[0])).size;
    }
    return {
      key: v,
      title: vid.title,
      vidder: vid.vidder,
      description: vid.description,
      date_made: vid.date_made,
      song: vid.song,
      artist: vid.artist,
      width: vid.width,
      height: vid.height,
      fandoms: vid.fandoms,
      mp4: mp4 ? mp4[0] : null,
      mp4size: filesize(mp4size)
    };
  });

  for (vid of vids.filter(v => v.mp4)) {
    const vidTemplate = `---
layout: vid.html
vidkey: ${vid.key}
date:   ${vid.date_made}
title:  ${vid.title}
creators: ${vid.vidder}
song: ${vid.song}
artist: ${vid.artist}
width: ${vid.width}
height: ${vid.height}
fandoms: ${vid.fandoms ? vid.fandoms.join(", ") : ""}
mp4: ${vid.mp4 ? vid.mp4 : null}
mp4size: ${vid.mp4 ? vid.mp4size : null}
collection: vids
---

  <div>
  ${vid.description}
  </div>
  `;
    fs.writeFileSync(`./src/vids/${vid.key}.md`, vidTemplate);
    fs.writeFileSync(
      `./src/player/${vid.key}.md`,
      vidTemplate
        .replace("vid.html", "twitterplayer.html")
        .replace("collection: vids", "collection: playerVids")
    );
  }
}

nunjucks.configure("./layouts", { watch: false, noCache: true });

Metalsmith(process.cwd())
  .metadata({
    title: "Luminosity Vids",
    // description: "It's about saying »Hello« to the World.",
    generator: "Metalsmith",
    url: "http://www.metalsmith.io/"
  })
  .source("./src")
  .destination("./build")
  .clean(true)
  .use(less())
  .use(autoprefixer())
  .use(
    metadata({
      site: "site.json",
      links: "data/links.json",
      fandoms: "data/fandoms.json"
    })
  )
  .use(
    collections({
      posts: {
        pattern: "posts/**/*.md",
        sortBy: "date",
        reverse: true
      },
      vids: {
        pattern: "vids/*.md",
        sortBy: "date",
        reverse: true
      },
      playerVids: {
        pattern: "player/*.md",
        sortBy: "date",
        reverse: true
      }
    })
  )
  .use(markdown())
  .use(
    metacopy({
      file: [
        {
          src: "contents",
          dest: "bodyContent"
        }
      ]
    })
  )
  .use(
    permalinks({
      // original options would act as the keys of a `default` linkset,
      pattern: "post/:date/:title",
      date: "YYYY/MM/DD",

      // each linkset defines a match, and any other desired option
      linksets: [
        // {
        //   match: { collection: "posts" },
        //   pattern: "post/:title",
        //   // date: "mmddyy"
        // },
        {
          match: { collection: "vids" },
          pattern: "vid/:vidkey"
          // date: "mmddyy"
        },
        {
          match: { collection: "playerVids" },
          pattern: "vidplayer/:vidkey"
          // date: "mmddyy"
        }
      ]
    })
  )
  .use(
    pagination({
      "collections.vids": {
        perPage: 20,
        layout: "vidindex.html",
        first: "vids/index.html",
        last: "vids/last.html",
        path: "vids/:num/index.html",
        filter: function(page) {
          return !page.private;
        },
        pageMetadata: {
          title: "Archive"
        }
      },
      "collections.posts": {
        perPage: 20,
        layout: "vidindex.html",
        first: "posts/index.html",
        path: "posts/:num/index.html",
        filter: function(page) {
          return !page.private;
        },
        pageMetadata: {
          title: "Archive"
        }
      }
    })
  )
  .use(paths({ property: "paths" }))
  .use(
    layouts({
      engine: "nunjucks",
      pattern: "**/*.html**"
    })
  )
  .use(
    inplace({
      pattern: "**/*.html.**"
    })
  )
  // .use(htmlMinifier())
  .build(function(err, files) {
    if (err) {
      throw err;
    }
  });
