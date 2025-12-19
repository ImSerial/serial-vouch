require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActivityType
} = require("discord.js");
const Database = require("better-sqlite3");

/* ================= CONFIG ================= */

const OWNERS = [
  "212834472436039681",
  "1450962706281660517",
  "212834472436039681"
];

const EMBED_COLOR = 0xFF0000;
const PER_PAGE = 5;
const STREAM_URL = "https://twitch.tv/babawontop";

/* ================= BASIC CHECKS ================= */

if (!process.env.TOKEN || !process.env.CLIENT_ID) {
  console.error("[BOOT] ❌ TOKEN ou CLIENT_ID manquant dans .env");
  process.exit(1);
}

/* ================= DB ================= */

const db = new Database("./vouches.sqlite");
console.log("[BOOT] ✅ SQLite chargé");

db.prepare(`
  CREATE TABLE IF NOT EXISTS real_vouches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_user_id TEXT,
    author_user_id TEXT,
    service TEXT,
    note INTEGER,
    created_at INTEGER
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS fake_vouches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_user_id TEXT,
    description TEXT,
    stars INTEGER,
    seller_id TEXT,
    created_at INTEGER
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS vouch_channel_config (
    guild_id TEXT PRIMARY KEY,
    channel_id TEXT
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS logs_config (
    guild_id TEXT PRIMARY KEY,
    channel_id TEXT
  )
`).run();

/* ✅ AJOUT: rôle à donner après un vrai vouch */
db.prepare(`
  CREATE TABLE IF NOT EXISTS vouch_role_config (
    guild_id TEXT PRIMARY KEY,
    role_id TEXT
  )
`).run();

/* ================= CLIENT ================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

/* ================= UTILS ================= */

const isOwner = (id) => OWNERS.includes(id);

const getVouchChannelId = (guildId) =>
  db.prepare("SELECT channel_id FROM vouch_channel_config WHERE guild_id = ?")
    .get(guildId)?.channel_id;

const getLogsChannelId = (guildId) =>
  db.prepare("SELECT channel_id FROM logs_config WHERE guild_id = ?")
    .get(guildId)?.channel_id;

/* ✅ AJOUT: récupérer le rôle configuré */
const getVouchRoleId = (guildId) =>
  db.prepare("SELECT role_id FROM vouch_role_config WHERE guild_id = ?")
    .get(guildId)?.role_id;

/* ✅ FIX: évite les IDs vides -> plus de <@> */
const randomOwner = () => {
  const valid = OWNERS.filter((x) => typeof x === "string" && x.trim().length > 0);
  if (!valid.length) return null;
  return valid[Math.floor(Math.random() * valid.length)];
};

const randomStars = () => Math.floor(Math.random() * 3) + 3; // 3..5

function parseTime(input) {
  // accepte: 60s, 2m, 1h
  const m = String(input || "").trim().match(/^(\d+)(s|m|h)$/i);
  if (!m) return null;
  const value = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const map = { s: 1000, m: 60000, h: 3600000 };
  return value * map[unit];
}

function randomBrainrotPhrase() {
  const phrases = [
    // Trades rapides / directs
    "Trade fait direct, rien à dire",
    "Échange instantané, clean",
    "Direct après le message",
    "Rapide et efficace",
    "Transaction immédiate",
    "Trade sans attente",
    "Fait en quelques secondes",
    "On a trade direct, zéro problème",
    "Trade validé instant",
    "Réponse rapide, trade clean",

    // Sérieux / confiance
    "Personne sérieuse, je recommande",
    "Très fiable, aucun souci",
    "Carré du début à la fin",
    "Vendeur sérieux",
    "Confiance totale",
    "Aucune arnaque",
    "Tout est clean, je valide",
    "Communication nickel",
    "Service respecté",
    "Très pro, rien à dire",

    // Roblox / Steal a Brainrot
    "Trade sur Steal a Brainrot, nickel",
    "Brainrot reçu instant",
    "Échange parfait sur Steal a Brainrot",
    "Tout s’est bien passé sur Brainrot",
    "Service rapide sur Steal a Brainrot",
    "Aucun problème sur Brainrot",
    "Trade Roblox clean",
    "Brainrot livré direct",
    "Rien à signaler sur Steal a Brainrot",
    "Trade validé sur Brainrot",

    // Paiement / service
    "Paiement reçu immédiatement",
    "Service rendu sans problème",
    "Transaction terminée proprement",
    "Service rapide et sérieux",
    "Tout a été respecté",
    "Règlement OK, trade OK",
    "Top, c’est carré",
    "Simple et efficace",
    "Merci, parfait",
    "RAS",

    // Courts réalistes
    "Clean",
    "Rapide",
    "Legit",
    "Parfait",
    "Carré",
    "Impeccable",

    // ===== NOUVELLES PHRASES AJOUTÉES =====
    "ty for the trade, super smooth fr",
    "appreciate u guys, was fast & safe",
    "legit mm, no stress at all",
    "thanks for helping with my dragon trade, everything went clean",
    "got my spider safely, tysm solvero",
    "combo trade went perfect, thx mm",
    "ngl I was scared but this mm is actually legit lol",
    "quick n easy trade, appreciate it",
    "thanks for the Halloween dragon, all smooth",
    "trustworthy mm, ty for handling it",
    "safe trade, tysm for the help",
    "got my neon dragon delivered, all good",
    "garbazilla trade done, appreciate u",
    "esok trade went perfectly, ty guys",
    "mutation trade was smooth asf thanks",
    "chimpenzini trade safe, no issues ty",
    "dragon for combo deal complete, ty for hosting",
    "good mm, everything verified properly",
    "fr this mm is solid, ty again",
    "thanks solvero, trade went fast",
    "just did my spider brainrot trade, all safe tysm",
    "bro this was actually legit, ty for the help",
    "big vouch, they handled my chocolate dragon trade perfectly",
    "smooth esok delivery, appreciate u",
    "trusted mm, thx for making it easy",
    "ty for being patient w me lol, trade was good",
    "neon dragon accepted and delivered safely ty",
    "just finished my combo trade, 10/10",
    "safe n quick, vouch for solvero mm",
    "good communication, trade went fine ty"
  ];

  return phrases[Math.floor(Math.random() * phrases.length)];
}

async function getRandomMember(guild) {
  try {
    // On évite le cache vide : fetch limité.
    const members = await guild.members.fetch({ limit: 1000 });
    if (!members || members.size === 0) return null;
    return members.random();
  } catch (e) {
    console.error("[getRandomMember] ❌", e?.message || e);
    return null;
  }
}

function makeLogEmbed(title, lines) {
  // Embed logs différent des vouches (structure + titre)
  return new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setDescription(
      `LOG — ${title}\n\n${lines.join("\n")}`
    );
}

/* ================= SLASH COMMANDS (DEPLOY) ================= */

const commands = [
  new SlashCommandBuilder()
    .setName("setchannelvouch")
    .setDescription("Définir le salon où seront envoyés les vouches")
    .addChannelOption(o =>
      o.setName("salon")
        .setDescription("Salon des vouches")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("setlogs")
    .setDescription("Définir le salon où seront envoyés les logs")
    .addChannelOption(o =>
      o.setName("salon")
        .setDescription("Salon des logs")
        .setRequired(true)
    ),

  /* ✅ AJOUT: /setrole role: */
  new SlashCommandBuilder()
    .setName("setrole")
    .setDescription("Définir le rôle donné après un vouch réel")
    .addRoleOption(o =>
      o.setName("role")
        .setDescription("Rôle à attribuer après un vouch réel")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("vouch")
    .setDescription("Envoyer un vouch réel")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Utilisateur ciblé")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("service")
        .setDescription("Service rendu")
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("note")
        .setDescription("Note")
        .setRequired(true)
        .addChoices(
          { name: "1/5", value: 1 },
          { name: "2/5", value: 2 },
          { name: "3/5", value: 3 },
          { name: "4/5", value: 4 },
          { name: "5/5", value: 5 }
        )
    ),

  new SlashCommandBuilder()
    .setName("fakevouch")
    .setDescription("Démarrer un cycle de fake vouch (min 60s)")
    .addStringOption(o =>
      o.setName("time")
        .setDescription("Ex: 60s, 2m, 1h")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("showvouch")
    .setDescription("Afficher toutes les personnes qui ont vouch un utilisateur")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Utilisateur ciblé")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("bot-name")
    .setDescription("Changer le nom du bot")
    .addStringOption(o =>
      o.setName("name")
        .setDescription("Nouveau nom du bot")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("bot-avatar")
    .setDescription("Changer l’avatar du bot")
    .addStringOption(o =>
      o.setName("lien")
        .setDescription("Lien direct vers une image")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("bot-status")
    .setDescription("Changer le statut du bot")
    .addStringOption(o =>
      o.setName("style")
        .setDescription("Statut")
        .setRequired(true)
        .addChoices(
          { name: "online", value: "online" },
          { name: "idle", value: "idle" },
          { name: "dnd", value: "dnd" },
          { name: "invisible", value: "invisible" }
        )
    ),

  new SlashCommandBuilder()
    .setName("bot-activities")
    .setDescription("Changer l’activité du bot")
    .addStringOption(o =>
      o.setName("type")
        .setDescription("Type")
        .setRequired(true)
        .addChoices(
          { name: "playing", value: "playing" },
          { name: "watching", value: "watching" },
          { name: "listening", value: "listening" },
          { name: "competing", value: "competing" },
          { name: "streaming", value: "streaming" }
        )
    )
    .addStringOption(o =>
      o.setName("description")
        .setDescription("Description")
        .setRequired(true)
    )
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("[DEPLOY] ⏳ Déploiement des slash commands...");
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log("[DEPLOY] ✅ Slash commands déployées");
  } catch (e) {
    console.error("[DEPLOY] ❌ Erreur deploy:", e);
  }
})();

/* ================= FAKEVOUCH SCHEDULER ================= */

// guildId -> { timeout: Timeout, interval: Interval, ms: number }
const fakeJobs = new Map();

function clearFakeJob(guildId) {
  const job = fakeJobs.get(guildId);
  if (!job) return;
  if (job.timeout) clearTimeout(job.timeout);
  if (job.interval) clearInterval(job.interval);
  fakeJobs.delete(guildId);
  console.log(`[FAKE] 🧹 Job cleared for guild ${guildId}`);
}

/* ================= READY ================= */

client.on("ready", () => {
  console.log(`[READY] ✅ Connecté en tant que ${client.user.tag}`);
});

/* ================= INTERACTIONS ================= */

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isButton()) {
      // Les boutons de showvouch sont gérés par les collectors (plus bas).
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const cmd = interaction.commandName;
    const guildId = interaction.guild?.id;

    console.log(`[CMD] /${cmd} by ${interaction.user.id} in guild ${guildId || "DM"}`);

    if (!guildId || !interaction.guild) {
      return interaction.reply({ content: "❌ Commande indisponible en DM.", flags: 64 });
    }

    const vouchChannelId = getVouchChannelId(guildId);
    const logsChannelId = getLogsChannelId(guildId);
    const vouchRoleId = getVouchRoleId(guildId);

    /* ---------- /setchannelvouch ---------- */
    if (cmd === "setchannelvouch") {
      if (!isOwner(interaction.user.id)) {
        return interaction.reply({ content: "❌ Accès refusé.", flags: 64 });
      }
      await interaction.deferReply({ flags: 64 });
      const ch = interaction.options.getChannel("salon");

      console.log(`[SET] setchannelvouch -> ${ch?.id}`);

      db.prepare(`
        INSERT INTO vouch_channel_config (guild_id, channel_id)
        VALUES (?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id
      `).run(guildId, ch.id);

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setDescription(`Salon des vouches défini → <#${ch.id}> (${ch.id})`)
        ]
      });
    }

    /* ---------- /setlogs ---------- */
    if (cmd === "setlogs") {
      if (!isOwner(interaction.user.id)) {
        return interaction.reply({ content: "❌ Accès refusé.", flags: 64 });
      }
      await interaction.deferReply({ flags: 64 });
      const ch = interaction.options.getChannel("salon");

      console.log(`[SET] setlogs -> ${ch?.id}`);

      db.prepare(`
        INSERT INTO logs_config (guild_id, channel_id)
        VALUES (?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id
      `).run(guildId, ch.id);

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setDescription(`Salon des logs défini → <#${ch.id}> (${ch.id})`)
        ]
      });
    }

    /* ✅ ---------- /setrole ---------- */
    if (cmd === "setrole") {
      if (!isOwner(interaction.user.id)) {
        return interaction.reply({ content: "❌ Accès refusé.", flags: 64 });
      }
      await interaction.deferReply({ flags: 64 });

      const role = interaction.options.getRole("role");
      if (!role) {
        return interaction.editReply("❌ Rôle invalide.");
      }

      db.prepare(`
        INSERT INTO vouch_role_config (guild_id, role_id)
        VALUES (?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET role_id = excluded.role_id
      `).run(guildId, role.id);

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setDescription(`Rôle configuré → <@&${role.id}> (${role.id})`)
        ]
      });
    }

    /* ---------- /vouch ---------- */
    if (cmd === "vouch") {
      // No owner check here; accessible to all
      await interaction.deferReply({ flags: 64 });

      if (!vouchChannelId) {
        console.log("[VOUCH] ❌ vouchChannelId ");
        return interaction.editReply("❌ Salon des vouches non défini. Utilise /setchannelvouch.");
      }

      const target = interaction.options.getUser("user");
      const service = interaction.options.getString("service");
      const note = interaction.options.getInteger("note");
      const now = Math.floor(Date.now() / 1000);

      console.log(`[VOUCH] target=${target.id} note=${note} channel=${vouchChannelId}`);

      db.prepare(`
        INSERT INTO real_vouches (target_user_id, author_user_id, service, note, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(target.id, interaction.user.id, service, note, Date.now());

      const vouchEmbed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setDescription(
          `VOUCH RÉEL\n\n` +
          `Utilisateur : <@${target.id}> (${target.id})\n` +
          `Par : <@${interaction.user.id}> (${interaction.user.id})\n` +
          `Service : ${service}\n` +
          `Note : ${"⭐".repeat(note)}\n\n` +
          `<t:${now}:R>`
        );

      const vouchChannel = interaction.guild.channels.cache.get(vouchChannelId);
      if (!vouchChannel) {
        console.log("[VOUCH] ❌ vouchChannel introuvable");
        return interaction.editReply("❌ Salon vouch introuvable (supprimé ou permissions).");
      }

      await vouchChannel.send({ embeds: [vouchEmbed] });

      /* ✅ AJOUT: donner le rôle après un VRAI vouch (pas fakevouch) */
      if (vouchRoleId) {
        try {
          const member = await interaction.guild.members.fetch(interaction.user.id);
          const role = interaction.guild.roles.cache.get(vouchRoleId);

          if (!role) {
            console.log(`[ROLE] ⚠️ role introuvable: ${vouchRoleId}`);
          } else if (!member.roles.cache.has(role.id)) {
            await member.roles.add(role);
            console.log(`[ROLE] ✅ role ${role.id} ajouté à ${member.id}`);
          }
        } catch (e) {
          console.log("[ROLE] ❌ add role error:", e?.message || e);
        }
      }

      if (logsChannelId) {
        const logsChannel = interaction.guild.channels.cache.get(logsChannelId);
        if (logsChannel) {
          const logEmbed = makeLogEmbed("VOUCH", [
            `Auteur : <@${interaction.user.id}> (${interaction.user.id})`,
            `Cible : <@${target.id}> (${target.id})`,
            `Note : ${note}/5`,
            `Service : ${service}`
          ]);
          logsChannel.send({ embeds: [logEmbed] }).catch((e) => {
            console.log("[LOGS] ❌ send vouch log:", e?.message || e);
          });
        }
      }

      return interaction.editReply("✅ Vouch envoyé.");
    }

    /* ---------- /fakevouch ---------- */
    if (cmd === "fakevouch") {
      if (!isOwner(interaction.user.id)) {
        return interaction.reply({ content: "❌ Accès refusé.", flags: 64 });
      }
      await interaction.deferReply({ flags: 64 });

      const ms = parseTime(interaction.options.getString("time"));
      console.log(`[FAKE] time=${interaction.options.getString("time")} parsed=${ms}`);

      if (!ms || ms < 60000) {
        return interaction.editReply("❌ Temps minimum : 60s (ex: 60s, 2m, 1h).");
      }

      if (!vouchChannelId) {
        return interaction.editReply("❌ Salon des vouches non défini. Utilise /setchannelvouch.");
      }

      // Stop ancien job (timeout + interval)
      clearFakeJob(guildId);

      const vouchChannel = interaction.guild.channels.cache.get(vouchChannelId);
      if (!vouchChannel) {
        console.log("[FAKE] ❌ vouchChannel introuvable");
        return interaction.editReply("❌ Salon vouch introuvable (supprimé ou permissions).");
      }

      const sendFake = async () => {
        try {
          const member = await getRandomMember(interaction.guild);
          if (!member) {
            console.log("[FAKE] ❌ Aucun membre random (fetch vide/erreur)");
            return;
          }

          const seller = randomOwner();
          if (!seller) {
            console.log("[FAKE] ❌ Aucun owner valide (liste OWNERS vide/incorrecte)");
            return;
          }

          const stars = randomStars();
          const desc = randomBrainrotPhrase();
          const now = Math.floor(Date.now() / 1000);

          db.prepare(`
            INSERT INTO fake_vouches (target_user_id, description, stars, seller_id, created_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(member.id, desc, stars, seller, Date.now());

          const fakeEmbed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setDescription(
              `VOUCH\n\n` +
              `Utilisateur : <@${member.id}> (${member.id})\n` +
              `Seller : <@${seller}> (${seller})\n` +
              `Message : ${desc}\n` +
              `Note : ${"⭐".repeat(stars)}\n\n` +
              `<t:${now}:R>`
            )
            .setFooter({ text: "Script dev By Djibril" });

          await vouchChannel.send({ embeds: [fakeEmbed] });
          console.log(`[FAKE] ✅ sent -> target=${member.id} seller=${seller} stars=${stars}`);

          if (logsChannelId) {
            const logsChannel = interaction.guild.channels.cache.get(logsChannelId);
            if (logsChannel) {
              const logEmbed = makeLogEmbed("VOUCH", [
                `Cible : <@${member.id}> (${member.id})`,
                `Seller : <@${seller}> (${seller})`,
                `Note : ${stars}/5`,
                `Intervalle : ${Math.floor(ms / 1000)}s`
              ]);
              logsChannel.send({ embeds: [logEmbed] }).catch((e) => {
                console.log("[LOGS] ❌ send fake log:", e?.message || e);
              });
            }
          }
        } catch (e) {
          console.error("[FAKE] ❌ sendFake error:", e);
        }
      };

      // IMPORTANT: pas de double envoi -> on attend ms, on envoie 1, puis interval
      const timeout = setTimeout(async () => {
        await sendFake();
        const interval = setInterval(sendFake, ms);
        fakeJobs.set(guildId, { timeout: null, interval, ms });
        console.log(`[FAKE] ▶ interval started guild=${guildId} every ${ms}ms`);
      }, ms);

      fakeJobs.set(guildId, { timeout, interval: null, ms });

      return interaction.editReply(`✅ Cycle fake vouch lancé. Premier envoi dans ${Math.floor(ms / 1000)}s.`);
    }

    /* ---------- /showvouch ---------- */
    if (cmd === "showvouch") {
      await interaction.deferReply({ flags: 64 });

      const target = interaction.options.getUser("user");
      console.log(`[SHOW] target=${target.id}`);

      const rows = db.prepare(`
        SELECT * FROM real_vouches
        WHERE target_user_id = ?
        ORDER BY created_at DESC
      `).all(target.id);

      console.log(`[SHOW] rows=${rows.length}`);

      if (!rows.length) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(EMBED_COLOR)
              .setDescription(`Aucun vouch pour <@${target.id}> (${target.id}).`)
          ]
        });
      }

      let page = 0;
      const maxPage = Math.ceil(rows.length / PER_PAGE) - 1;
      const uid = interaction.id; // unique

      const render = () => {
        const slice = rows.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

        let desc = `Vouches de <@${target.id}> (${target.id})\n`;
        desc += `Page ${page + 1}/${maxPage + 1}\n\n`;

        for (const v of slice) {
          const ts = v.created_at ? Math.floor(v.created_at / 1000) : null;
          desc +=
            `Par : <@${v.author_user_id}> (${v.author_user_id})\n` +
            `Service : ${v.service}\n` +
            `Note : ${"⭐".repeat(v.note)}\n` +
            (ts ? `<t:${ts}:R>\n\n` : `\n`);
        }

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`prev_${uid}`)
            .setLabel("⬅️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === 0),
          new ButtonBuilder()
            .setCustomId(`next_${uid}`)
            .setLabel("➡️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === maxPage)
        );

        return { desc, row };
      };

      const first = render();
      const msg = await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setDescription(first.desc)
        ],
        components: [first.row]
      });

      const collector = msg.createMessageComponentCollector({ time: 60_000 });

      collector.on("collect", async (i) => {
        try {
          // Si ce n’est pas le bon message / session
          if (!i.customId.endsWith(uid)) return;

          // Seul l’auteur de la commande peut paginer
          if (i.user.id !== interaction.user.id) {
            return i.reply({ content: "❌ Pas pour toi.", flags: 64 });
          }

          if (i.customId.startsWith("prev_")) page--;
          if (i.customId.startsWith("next_")) page++;

          const updated = render();
          await i.update({
            embeds: [
              new EmbedBuilder()
                .setColor(EMBED_COLOR)
                .setDescription(updated.desc)
            ],
            components: [updated.row]
          });

          console.log(`[SHOW] page=${page + 1}/${maxPage + 1} by ${i.user.id}`);
        } catch (e) {
          console.error("[SHOW] ❌ collector error:", e);
          // au pire: on évite l'interaction failed côté bouton
          if (!i.replied && !i.deferred) {
            i.reply({ content: "❌ Erreur pagination.", flags: 64 }).catch(() => {});
          }
        }
      });

      collector.on("end", () => {
        console.log(`[SHOW] collector ended uid=${uid}`);
      });

      return;
    }

    /* ---------- /bot-name ---------- */
    if (cmd === "bot-name") {
      if (!isOwner(interaction.user.id)) {
        return interaction.reply({ content: "❌ Accès refusé.", flags: 64 });
      }
      await interaction.deferReply({ flags: 64 });
      const name = interaction.options.getString("name");
      console.log(`[BOT] setUsername -> ${name}`);
      await client.user.setUsername(name);
      return interaction.editReply("✅ Nom du bot modifié.");
    }

    /* ---------- /bot-avatar ---------- */
    if (cmd === "bot-avatar") {
      if (!isOwner(interaction.user.id)) {
        return interaction.reply({ content: "❌ Accès refusé.", flags: 64 });
      }
      await interaction.deferReply({ flags: 64 });
      const lien = interaction.options.getString("lien");
      console.log(`[BOT] setAvatar -> ${lien}`);
      await client.user.setAvatar(lien);
      return interaction.editReply("✅ Avatar du bot modifié.");
    }

    /* ---------- /bot-status ---------- */
    if (cmd === "bot-status") {
      if (!isOwner(interaction.user.id)) {
        return interaction.reply({ content: "❌ Accès refusé.", flags: 64 });
      }
      await interaction.deferReply({ flags: 64 });
      const style = interaction.options.getString("style");
      console.log(`[BOT] setStatus -> ${style}`);
      client.user.setStatus(style);
      return interaction.editReply("✅ Statut modifié.");
    }

    /* ---------- /bot-activities ---------- */
    if (cmd === "bot-activities") {
      if (!isOwner(interaction.user.id)) {
        return interaction.reply({ content: "❌ Accès refusé.", flags: 64 });
      }
      await interaction.deferReply({ flags: 64 });
      const type = interaction.options.getString("type");
      const description = interaction.options.getString("description");

      const typeMap = {
        playing: ActivityType.Playing,
        watching: ActivityType.Watching,
        listening: ActivityType.Listening,
        competing: ActivityType.Competing,
        streaming: ActivityType.Streaming
      };

      const activityType = typeMap[type] ?? ActivityType.Playing;

      console.log(`[BOT] setActivity -> type=${type} mapped=${activityType} desc="${description}"`);

      client.user.setActivity(description, {
        type: activityType,
        url: type === "streaming" ? STREAM_URL : undefined
      });

      return interaction.editReply("✅ Activité modifiée.");
    }

    // Si on arrive ici, commande non gérée
    console.log(`[CMD] ⚠️ Handler manquant pour /${cmd}`);
    return interaction.reply({ content: "❌ Commande non gérée (handler manquant).", flags: 64 });

  } catch (err) {
    console.error("[GLOBAL] ❌ interactionCreate error:", err);
    try {
      if (interaction && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "❌ Erreur interne.", flags: 64 });
      } else if (interaction && interaction.deferred && !interaction.replied) {
        await interaction.editReply("❌ Erreur interne.");
      }
    } catch {}
  }
});

/* ================= LOGIN ================= */

client.login(process.env.TOKEN).then(() => {
  console.log("[BOOT] ✅ login ok");
}).catch((e) => {
  console.error("[BOOT] ❌ login error:", e);
});
