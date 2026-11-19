import type { ClientSession, Types } from 'mongoose';
import User, { type UserDocument } from '../models/User.js';
import FeatureFlag from '../models/FeatureFlag.js';
import GymInvitation from '../models/GymInvitation.js';
import Center from '../models/Center.js';
import { centerDataModels } from '../tenancy/centerDataModels.js';
import { collectDeletionAssets, enqueueDeletionAssets } from './deletionMediaService.js';

export async function deletePersonalAccountData(user: UserDocument, successorId: Types.ObjectId, session: ClientSession) {
  const centerId = user.centerId;
  if (!centerId) throw new Error('Account has no center.');
      // Delete private account records; transfer operational records to the new owner.
      const privateModels = new Set(['GymInvitation', 'DeviceSession', 'CreditWallet', 'CreditLedgerEntry', 'PaymentOrder', 'AiUsage', 'AiUsageQuotaCounter', 'Notification', 'AuditLog', 'AssistantConversation', 'AssistantSuggestion', 'AiNutritionGenerationJob', 'AiWorkoutGenerationJob']);
      const assets = collectDeletionAssets(user.toObject());
      for (const model of centerDataModels) {
        if (model.modelName === 'User') continue;
        const references = Object.entries(model.schema.paths)
          .filter(([, path]) => path.options.ref === 'User')
          .map(([field]) => field);
        if (privateModels.has(model.modelName)) {
          const ownerField = ['userId', 'ownerPtId', 'ptId', 'actorId'].find(field => references.includes(field));
          if (ownerField) {
            const filter = { centerId, [ownerField]: user._id };
            for await (const document of model.collection.find(filter, { session })) collectDeletionAssets(document, assets);
            await model.collection.deleteMany(filter, { session });
          }
        } else {
          for (const field of references) {
            await model.collection.updateMany({ centerId, [field]: user._id }, { $set: { [field]: successorId } }, { session });
          }
        }
      }
      await FeatureFlag.updateMany({ centerId }, { $pull: { pilotUserIds: user._id } }, { session });
      await User.deleteOne({ _id: user._id, centerId }, { session });
      await GymInvitation.deleteMany({ userId: user._id }, { session });
      await Center.deleteMany({ workspaceType: 'PERSONAL', ownerPtId: user._id, status: 'SUSPENDED' }, { session });
      await enqueueDeletionAssets(assets, session);
}
