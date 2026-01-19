#!/usr/bin/env node
/**
 * Match WordPress comments to tapes and generate tape-comments.json
 * 
 * Usage: node scripts/match-wp-comments.mjs
 * 
 * Reads:
 *   - wp-comments-clean.json (from Desktop or specified path)
 *   - data/tapes.json
 * 
 * Outputs:
 *   - data/tape-comments.json (comments keyed by tape ID)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Paths
const TAPES_JSON = path.join(__dirname, '../data/tapes.json');
const WP_COMMENTS_JSON = process.env.WP_COMMENTS_PATH || 
  path.join(process.env.HOME, 'Desktop/wp-comments-clean.json');
const OUTPUT_JSON = path.join(__dirname, '../data/tape-comments.json');

// Manual mappings for known title variations (same tape, different naming)
const MANUAL_MAPPINGS = {
  'dj-dan-san-fran-disko-housing-project': 'dj-dan-housing-project',
  'dj-dan-the-funky-dope-green-project': 'dj-dan-funky-dope-green-project',
  'dj-dan-warehouse-flashback': 'dj-dan-warehouse-flashbacks-vol-1',
  'barry-weaver-live-at-bassrush': 'barry-weaver-live-at-bassrush-2002',
  'barry-weaver-live-at-soundcheck': 'barry-weaver-live-at-soundcheck-1997',
  'barry-weaver-untitled-1991': 'barry-weaver-1991',
  'dj-trance-family-live-at-joy-12-95': 'dj-trance-live-at-family-joy',
  'raw-and-dj-trance-wake-up-la': 'dj-trance-raw-wake-up-la',
  'powertools-mix-show-10-24-1992': 'powertools-10-24-92',
  
  // Circa '92 consolidation - multiple WordPress posts → single tape page
  'scott-hardkiss-circa-92': 'circa-92',
  'barry-weaver-circa-92': 'circa-92',
  'bleu-circa-92': 'circa-92',
  'doc-martin-circa-92': 'circa-92',
  'mark-lewis-circa-92': 'circa-92',
  
  // Circa '94 consolidation - multiple WordPress posts → single tape page
  'lenny-v-circa-94': 'circa-94',
  'eli-star-circa-94': 'circa-94',
  'resistance-d-circa-94': 'circa-94',
  'ernie-munson-circa-94': 'circa-94',
  'doc-martin-circa-94': 'circa-94',
  'skylab2000-circa-94': 'circa-94',
  'jason-bentley-circa-94': 'circa-94',
  
  // Trance Fester series - naming variations
  'dj-trance-fester-trance-fester-1': 'dj-trance-fester-vol-1',
  'dj-trance-fester-trance-fester-2': 'dj-trance-fester-vol-2',
  'dj-trance-fester-trance-fester-3': 'fester-dj-trance-vol-3',
  'dj-trance-fester-fester-trance-4': 'fester-dj-trance-vol-4',
  
  // Doc Martin tapes - title variations
  'doc-martin-flammable-groove-goa-aum-with-yourself': 'doc-martin-goa-aum-with-yourself',
  'doc-martin-dub-live-at-citrusonic': 'doc-martin-deep-urban-breakdown',
  'doc-martin-live-citrusonic-may-1992': 'doc-martin-live-at-citrusonic',
  'doc-martin-100-teknotronic-dance-mixes': 'doc-martin-teknotronic-dance-mixes',
  'doc-martin-live-at-gilligans-1991': 'doc-martin-live-at-gilligans-island-1991',
  
  // Steve Loria tapes
  'steve-loria-house-milkyway-rave-tape': 'steve-loria-love-saved-the-day',
  'steve-loria-live-at-citrusonic-spiral-trance-the-lions-dance': 'steve-loria-spiral-trance-lions-dance',
  
  // Ernie Munson
  'ernie-munson-ooga-booga-part-1-2': 'ernie-munson-ooga-booga',
  'ernie-munson-friends-of-distinction-boogie-buffet': 'ernie-munson-friends-of-distinction',
  'ernie-munson-naked': 'ernie-munson-naked',
  
  // DJ N2O
  'n2o-lifes-a-gassssss': 'n2o-lifes-a-gassssss',
  
  // Dom T.
  'dom-t-music-to-dance-to': 'dom-t-music-to-dance-to',
  
  // Additional mappings from manual review
  'mr-kool-aid-808-state-rave-1991': 'mr-kool-aid-live-from-808-state-rave',
  'dj-e-zone-march-1992': 'dj-e-zone-3-92',
  'raw-live-on-power-tools-1994': 'raw-live-on-powertools-1994',
  'djs-jughead-and-basskick-live-at-bassrush-5': 'jughead-basskick-bassrush-5',
  'omar-dj-thee-o-mind-waves': 'dj-thee-o-omar-mindwaves',
  'moonpup-this-is-moon-pup': 'moonpup-this-is-moonpup',
  'dj-chris-hyde-milk-and-cookies': 'chris-hyde-milk-cookies',
  'thee-o-planetary-rave-series': 'dj-thee-o-planetary-rave-series',
  'mojo-an-epic-oldskool-journey-iii': 'dj-mojo-an-epic-oldskool-journey-part-3',
  'josh-mcclintock-live-on-kuci-88-9-fm-riders-of-the-plastic-groove': 'josh-mcclintock-kuci-riders-of-the-plastic-groove',
  'tony-largo-live-maxx-vol-1': 'tony-largo-live-at-maxx-v1',
  'dj-trance-raw-4-turntable-madness-101': 'dj-trance-raw-4-turntable-madness',
  'dj-drc-the-california-project': 'drc-the-california-project',
  'dj-destructo-hard-medium-mixed-tape': 'destructo-hard-medium',
  'simon-markie-come-unity-iii-1993': 'simon-markie-mark-come-unity-iii',
  'oldschool-live-at-what-afterhours-1993': 'live-at-what-1993-mojo-unknown',
  'r-a-w-dj-trance-libra-mindstate': 'raw-dj-trance-libra-mindstate',
  'keoki-trance-dreamtime-kicking-1': 'keoki-let-the-street-speak-trance-dreamtime-kicking',
  'dj-jon-williams-fruit-salad': 'jon-williams-fruit-salad',
  'steve-leclair-live-at-808-state-1991': 'steve-leclair-live-at-808-state',
  'r-a-w-lost-in-the-jungle-hardcore-is-back': 'raw-lost-in-the-jungle',
  'dj-trance-too-much-going-on-upstairs-part-one': 'dj-trance-too-much-going-on-upstairs',
  'spun-josh-come-unity-1993': 'spun-josh-come-unity-1',
  'r-a-w-untitled-limited-edition': 'raw-untitled-limited-edition',
  'project-x-unlocks-the-house-jeno-keoki': 'keoki-jeno-project-x-unlocks-the-house',
  'parliament-i-live-fucking-loud': 'parliament-1-live-and-fucking-loud',
  'moonpup-music-for-tefs-ears-only': 'moonpup-tekno-for-tefs-ears-only',
  'jesse-brooks-dj-jesse-1992': 'jesse-brooks-dj-jesse-92',
  'dj-mellinfunk-oscar-da-grouch-live-at-what-03-05-1993': 'dj-mellinfunk-oscar-da-grouch-live-at-what',
  'dj-jon-bishop-techno-mix-july-1992': 'jon-bishop-techno-mix-92',
  'xavier-live-opium-madame-butterfly': 'xavier-live-at-opium-8-12-95',
  'moonpup-untitled-property-of-tef': 'moonpup-property-of-tef',
  'dj-curious-the-dark-side-part-1': 'dj-curious-the-darkside-part-1',
  'r-a-w-hellborn-50-levels-deep': 'raw-hellborn',
  'mark-farina-planet-earth-technology-has-its-subliminal-side': 'dj-mark-farina-planet-earth-technology-has-its-subliminal-side',
  'mark-farina-children-are-playing': 'mark-farina-the-children-are-playing',
  'jason-bentley-october-1992-mixed-tape': 'jason-bently-oct-92',
  'dj-thee-o-and-the-kandyman-us-and-them': 'dj-thee-o-kandyman-us-them',
  'mr-buzz-acid-hits-vol-14': 'mr-buzz-acid-hits-14',
  'dancing-skeletons-halloween-1994': 'dancing-skeletons-fresh-produce-1994',
  'thee-o-the-mara-project': 'dj-thee-o-mara-project',
  'shaheen-jon-bishop-electric-tikki-doll': 'jon-bishop-shaheen-electric-tikki-doll',
  'r-a-w-dj-mellinfunk-volume-1': 'raw-dj-mellinfunk-vol-1',
  'steve-loria-street-sounds-deep-house-mix': 'steve-loria-the-street-sounds-deep-house-mix',
  'r-a-w-and-jonny-5-naturl-born-junglists': 'raw-jonny-5-natural-born-junglists',
  'mojo-return-of-the-funky-warrior': 'dj-mojo-return-of-the-funky-warrior',
  'dj-thee-o-drum-beats-of-love': 'dj-thee-o-live-from-the-desert',
  'dj-mojo-an-epic-oldskool-journey-part-ii': 'dj-mojo-an-epic-oldskool-journey-part-2',
  'dj-mark-lewis-global-lust-volume-5': 'mark-lewis-global-lust-vol-5',
  'dj-curious-abstract-technics-vol-1': 'dj-curious-abstract-technics',
  'thee-o-the-mara-project-part-ii': 'dj-thee-o-mara-project-ii',
  'raymond-roker-santa-kruzin-7-of-9': 'raymond-roker-santa-kruz-7-of-9',
  'r-a-w-no-darkness': 'raw-no-darkness',
  'dj-trance-the-real-oldschool': 'dj-trance-the-real-oldskool',
  'aldo-bender-smile-93-vol-ii-far-cry': 'aldo-bender-smile93-vol2-far-cry',
  'mark-farina-chris-hyde-live-melodic': 'mark-farina-chris-hyde-melodic',
  'aldo-bender-smile-93-vol-iii-lift-off': 'aldo-bender-smile93-vol3-lift-off',
  'mercury-live-comeunity-june-1992': 'mercury-come-unity-june-92',
  'jon-williams-1991-mix-tape': 'jon-williams-91',
  'dj-trance-you-must-bee-stoned': 'dj-trance-you-must-be-stoned-pomme-fritz',
  'dj-curious-the-darkside-ii': 'dj-curious-the-darkside-part-2',
};

/**
 * Load and parse JSON file
 */
function loadJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error.message);
    process.exit(1);
  }
}

/**
 * Build tape ID lookup maps for fuzzy matching
 */
function buildTapeLookup(tapes) {
  const tapeIds = new Set(tapes.map(t => t.id));
  const tapesByVariant = new Map();

  tapes.forEach(tape => {
    tapesByVariant.set(tape.id, tape.id);
    
    // Add variant without year suffix
    const withoutYear = tape.id.replace(/-\d{4}$/, '');
    if (withoutYear !== tape.id && !tapesByVariant.has(withoutYear)) {
      tapesByVariant.set(withoutYear, tape.id);
    }
    
    // Add variant without volume suffix
    const withoutVol = tape.id.replace(/-vol-?\d+$/i, '');
    if (withoutVol !== tape.id && !tapesByVariant.has(withoutVol)) {
      tapesByVariant.set(withoutVol, tape.id);
    }
  });

  return { tapeIds, tapesByVariant };
}

/**
 * Find matching tape ID for a WordPress post name
 */
function findTapeMatch(postName, { tapeIds, tapesByVariant }) {
  // Try exact match
  if (tapeIds.has(postName)) {
    return postName;
  }
  
  // Try manual mapping
  if (MANUAL_MAPPINGS[postName]) {
    return MANUAL_MAPPINGS[postName];
  }
  
  // Try fuzzy match by variant
  if (tapesByVariant.has(postName)) {
    return tapesByVariant.get(postName);
  }
  
  // Try without year suffix
  const withoutYear = postName.replace(/-\d{4}$/, '');
  if (tapesByVariant.has(withoutYear)) {
    return tapesByVariant.get(withoutYear);
  }
  
  // Try without volume suffix
  const withoutVol = postName.replace(/-vol-?\d+$/i, '');
  if (tapesByVariant.has(withoutVol)) {
    return tapesByVariant.get(withoutVol);
  }
  
  return null;
}

/**
 * Process comment content: strip non-Discogs links, preserve Discogs
 */
function processCommentContent(content) {
  if (!content) return '';
  
  // Strip all HTML anchor tags (removes all links)
  let processed = content.replace(/<a\s+[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2');
  
  // Clean up common HTML entities
  processed = processed
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  
  // Fix malformed double-protocol URLs (http://www.http://www. -> https://www.)
  processed = processed.replace(/https?:\/\/(?:www\.)?https?:\/\/(?:www\.)?/gi, 'https://www.');
  
  // Normalize line breaks
  processed = processed
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
  
  return processed;
}

/**
 * Main processing function
 */
function processComments() {
  console.log('Loading data files...');
  
  // Load data
  const tapes = loadJSON(TAPES_JSON);
  const wpData = loadJSON(WP_COMMENTS_JSON);
  
  console.log(`Loaded ${tapes.length} tapes`);
  console.log(`Loaded ${wpData.posts.length} WordPress posts`);
  
  // Build lookup tables
  const tapeLookup = buildTapeLookup(tapes);
  
  // Process posts and match to tapes
  const tapeComments = {};
  let totalMatched = 0;
  let totalComments = 0;
  let unmatchedPosts = [];
  
  wpData.posts
    .filter(post => post.post_status === 'publish')
    .forEach(post => {
      // Filter to approved comments only
      const approvedComments = post.comments.filter(c => c.approved === '1');
      
      if (approvedComments.length === 0) {
        return;
      }
      
      totalComments += approvedComments.length;
      
      // Try to match post to tape
      const tapeId = findTapeMatch(post.post_name, tapeLookup);
      
      if (!tapeId) {
        unmatchedPosts.push({
          post_name: post.post_name,
          post_title: post.post_title,
          comments_count: approvedComments.length
        });
        return;
      }
      
      // Check if this is a circa consolidation (multiple posts → one tape)
      const isCircaConsolidation = (tapeId === 'circa-92' || tapeId === 'circa-94');
      
      // Transform and sort comments
      const comments = approvedComments
        .map(c => {
          const comment = {
            author: c.author,
            date: c.date_gmt.split(' ')[0], // Extract YYYY-MM-DD
            content: processCommentContent(c.content)
          };
          
          // Add source metadata for circa consolidations
          if (isCircaConsolidation) {
            comment.source_post = post.post_name;
            comment.source_title = post.post_title;
          }
          
          return comment;
        })
        .sort((a, b) => a.date.localeCompare(b.date)); // Sort oldest first
      
      // Add to tape comments
      if (!tapeComments[tapeId]) {
        tapeComments[tapeId] = [];
      }
      tapeComments[tapeId].push(...comments);
      totalMatched += comments.length;
    });
  
  // Sort comments within each tape (in case multiple posts matched)
  Object.keys(tapeComments).forEach(tapeId => {
    tapeComments[tapeId].sort((a, b) => a.date.localeCompare(b.date));
  });
  
  // Write output
  console.log('\nWriting output...');
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(tapeComments, null, 2));
  
  // Print summary
  console.log('\n=== MATCHING SUMMARY ===');
  console.log(`Total WordPress comments: ${totalComments}`);
  console.log(`Matched comments: ${totalMatched}`);
  console.log(`Unmatched comments: ${totalComments - totalMatched}`);
  console.log(`Tapes with comments: ${Object.keys(tapeComments).length}`);
  console.log(`\nOutput written to: ${OUTPUT_JSON}`);
  
  // Show unmatched posts with most comments
  if (unmatchedPosts.length > 0) {
    console.log('\n=== TOP UNMATCHED POSTS ===');
    unmatchedPosts
      .sort((a, b) => b.comments_count - a.comments_count)
      .slice(0, 10)
      .forEach(post => {
        console.log(`  ${post.post_name} (${post.comments_count} comments)`);
      });
  }
}

// Run
processComments();
