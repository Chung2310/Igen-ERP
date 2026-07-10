const mongoose = require('mongoose');

async function main() {
  await mongoose.connect('mongodb://localhost:27017/igen-erp');
  console.log('Connected to MongoDB');
  
  const ResourceItemSchema = new mongoose.Schema({
    companyCode: String,
    section: String,
    type: String,
    name: String,
    parentId: String,
    fileUrl: String,
    mimeType: String,
    size: Number,
    driveType: String,
    creatorUid: String,
    creatorName: String,
    isFixed: Boolean,
    isDeleted: Boolean,
    deletedAt: Date,
    roomId: String,
  }, { timestamps: true });

  const ResourceItemModel = mongoose.model('ResourceItem', ResourceItemSchema);

  // Define our own list function identical to resource.service.ts list function
  async function list(companyCode, section, parentId, userId, roomId, requesterId) {
    const normalizedParent = parentId && parentId !== "root" ? parentId : null;
    
    // Simulate creation
    if (section === "local" && !normalizedParent) {
      const fixedFolderName = "_GOOGLE DOCUMENTS";
      let fixedFolder = await ResourceItemModel.findOne({
        companyCode,
        section: "local",
        parentId: null,
        name: fixedFolderName,
        type: "folder",
      });
      console.log('Creation check found fixed folder:', !!fixedFolder);
    }

    const query = {
      companyCode,
      section,
      parentId: normalizedParent,
      isDeleted: { $ne: true },
    };

    if (section === "local") {
      if (roomId) {
        query.roomId = roomId;
        query.name = { $ne: "_GOOGLE DOCUMENTS" };
      } else if (userId) {
        if (normalizedParent) {
          query.creatorUid = userId;
          query.roomId = null;
        } else {
          if (userId === requesterId) {
            query.$or = [
              { creatorUid: userId, roomId: null },
              { isFixed: true }
            ];
          } else {
            query.creatorUid = userId;
            query.roomId = null;
            query.name = { $ne: "_GOOGLE DOCUMENTS" };
          }
        }
      }
    }

    console.log('Executed Query:', JSON.stringify(query, null, 2));

    const items = await ResourceItemModel.find(query)
      .sort({ type: 1, name: 1 })
      .lean();

    return items;
  }

  // Test 1: User's personal space (roomId = null, userId = requesterId)
  console.log('\n--- TEST 1: Personal Space ---');
  const personalItems = await list('123', 'local', null, 'user123', null, 'user123');
  console.log('Result length:', personalItems.length);
  console.log('Results:', personalItems.map(i => i.name));

  // Test 2: Group Space (roomId = 'room456', userId = 'user123', requesterId = 'user123')
  console.log('\n--- TEST 2: Group Space ---');
  const groupItems = await list('123', 'local', null, 'user123', 'room456', 'user123');
  console.log('Result length:', groupItems.length);
  console.log('Results:', groupItems.map(i => i.name));

  await mongoose.disconnect();
}

main().catch(console.error);
