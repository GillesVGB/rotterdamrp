import { Client, GatewayIntentBits as I, Partials } from 'discord.js';
import { Store } from './database/store.js';
import { loadDefaults } from './config.js';
import { Mutex } from './utils/mutex.js';
import { Logger,Outbox } from './services/logging.js';
import { StaffService } from './services/staff.js';
import { ModerationService } from './services/moderation.js';
import { GiveawayService } from './services/giveaways.js';
import { DocumentService } from './services/documents.js';
import { EventService } from './services/events.js';
import { FiveMService } from './services/fivem.js';
import { SetupService } from './services/setup.js';
import { CommunicationService } from './services/communication.js';
import { SecurityEngine } from './security/engine.js';
import { Scheduler } from './services/scheduler.js';
import { wireEvents } from './events/index.js';
export function createContext(env,{store,client,defaults}={}) {
  const ctx={env,store:store || new Store(env.database),client:client || new Client({intents:[I.Guilds,I.GuildMembers,I.GuildModeration,I.GuildMessages,I.MessageContent,I.GuildWebhooks,I.GuildExpressions],partials:[Partials.Message,Partials.Channel,Partials.GuildMember],allowedMentions:{parse:[],repliedUser:false}}),mutex:new Mutex()};
  ctx.store.init(env.guildId,defaults || loadDefaults(env.configPath));
  // Valideer ook reeds opgeslagen configuratie bij iedere start.
  ctx.store.config(env.guildId);
  Object.assign(ctx,{logger:new Logger(ctx),outbox:new Outbox(ctx),staff:new StaffService(ctx),moderation:new ModerationService(ctx),giveaways:new GiveawayService(ctx),documents:new DocumentService(ctx),events:new EventService(ctx),fivem:new FiveMService(ctx),setup:new SetupService(ctx),communication:new CommunicationService(ctx),security:new SecurityEngine(ctx),scheduler:new Scheduler(ctx)});
  return ctx;
}
export function attach(ctx) { wireEvents(ctx); return ctx; }
