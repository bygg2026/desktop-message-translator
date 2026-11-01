// Sends only a fixed public test phrase, never chat data.
import { TranslationService } from '../ts/services/translation/TranslationService.node.ts';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const directory = await mkdtemp(join(tmpdir(), 'dmt-network-'));
try {
 const service = new TranslationService({path: join(directory,'config.json'),storage:{isEncryptionAvailable:()=>false,encryptString:()=>{throw Error();},decryptString:()=>{throw Error();}}});
 const result = await service.translate({text:'Hello, world!',direction:'receive',targetLanguage:'zh-CN'});
 if (!result?.trim()) throw Error('Empty provider result');
 console.log('Google fixed-phrase smoke:', result);
} finally { await rm(directory,{recursive:true,force:true}); }
