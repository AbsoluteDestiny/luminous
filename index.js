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
const copy = require("metalsmith-copy");
const pagination = require("metalsmith-pagination");
const jsonToFiles = require("metalsmith-json-to-files");
const htmlMinifier = require("metalsmith-html-minifier");
const ignore = require("metalsmith-ignore");
const each = require("metalsmith-each");
const filesize = require("filesize");
const watch = require("metalsmith-watch");
const frontmatter = require("front-matter");
let lumvids;

if (fs.existsSync("./lumvids.json")) {
  lumvids = require("./lumvids.json");

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
title:  ${vid.title}
fandoms:${vid.fandoms
      ? "\n" + vid.fandoms.map(f => "    - " + f).join("\n")
      : ""}
creators: ${vid.vidder}
song: ${vid.song}
artist: ${vid.artist}
date:   ${vid.date_made}
mp4name: ${vid.mp4 ? vid.mp4 : null}
mp4size: ${vid.mp4 ? vid.mp4size : null}
width: ${vid.width}
height: ${vid.height}
---

${vid.description}
  `;
    fs.writeFileSync(`./src/vids/${vid.key}.md`, vidTemplate);
  }
}

nunjucks.configure("./layouts", { watch: false, noCache: true });

// Pre-process vid markdowns for twitter player template

const vidPosts = fs.readdirSync("./src/vids/");

let fandoms = [];

for (md of vidPosts) {
  const fm = frontmatter(fs.readFileSync(path.join("./src/vids/", md), "utf8"));
  if (fm.attributes.fandoms) {
    for (fandom of fm.attributes.fandoms) {
      if (fandoms.indexOf(fandom) < 0) {
        fandoms.push(fandom);
      }
    }
  }
}

fandoms = fandoms.sort();

Metalsmith(process.cwd())
  .metadata({
    fandoms
  })
  .source("./src")
  .destination("./build")
  .clean(true)
  .use(less())
  .use(autoprefixer())
  .use(
    metadata({
      site: "data/site.json"
    })
  )
  .use(
    each((file, filename) => {
      file.basename = path.basename(filename, ".md");
      return filename;
    })
  )
  .use(
    collections({
      vids: {
        pattern: "vids/*.md",
        sortBy: "date",
        reverse: true
      }
    })
  )
  .use(markdown())
  .use(
    permalinks({
      // original options would act as the keys of a `default` linkset,
      pattern: "post/:date/:title",
      date: "YYYY/MM/DD",

      // each linkset defines a match, and any other desired option
      linksets: [
        {
          match: { collection: "vids" },
          pattern: "vid/:basename"
        }
      ]
    })
  )
  .use(paths({ property: "paths" }))
  .use(
    layouts({
      engine: "nunjucks",
      pattern: "**/*.html**",
      default: "vid.html"
    })
  )
  .use(
    inplace({
      pattern: "**/*.html.**"
    })
  )
  .use(
    copy({
      pattern: "assets/**/*.*",
      move: true,
      transform: function(file) {
        return path.join(
          ...path.dirname(file).split(path.sep).slice(1),
          path.basename(file)
        );
      }
    })
  )
  .use(
    htmlMinifier({
      removeAttributeQuotes: false,
      removeEmptyAttributes: false
    })
  )
  .build(function(err, files) {
    if (err) {
      throw err;
    } else {
      // Process metalsmith again for the twitter templates
      Metalsmith(process.cwd())
        .metadata({
          fandoms: fandoms.sort()
        })
        .source("./src")
        .destination("./build")
        .clean(false)
        .use(
          metadata({
            site: "data/site.json"
          })
        )
        .use(ignore("!vids/*.md"))
        .use(markdown())
        .use(
          permalinks({
            pattern: "vidplayer/:vidkey"
          })
        )
        .use(paths({ property: "paths" }))
        .use(
          layouts({
            engine: "nunjucks",
            pattern: "vidplayer/**/*.html**",
            default: "twitterplayer.html"
          })
        )
        .build(function(err, files) {
          if (err) {
            throw err;
          }
        });
    }
  });
