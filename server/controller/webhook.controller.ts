import { Request, Response } from 'express';
import { Student } from '../modules/student-management/models/student.model';

export const handleSePayWebhook = async (req: Request, res: Response) => {
  try {
    const webhookSecret = process.env.WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('Missing WEBHOOK_SECRET in environment variables');
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }

    const authHeader = req.headers.authorization || '';

    // Verify webhook secret
    // SePay typically sends Authorization: Apikey <secret> or Bearer <secret>
    if (!authHeader.includes(webhookSecret)) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const payload = req.body;
    console.log('Received SePay webhook:', payload);

    // Payload can be a single transaction or an array of transactions depending on SePay config
    const transactions = Array.isArray(payload) ? payload : [payload];

    for (const tx of transactions) {
      const {
        amountIn,
        transactionContent,
        referenceCode,
        transactionDate,
      } = tx;

      if (!amountIn || amountIn <= 0) continue;

      // Extract Student ID from the transaction content
      // E.g., transactionContent might contain the objectId (24 chars) or a custom student ID
      let studentId = '';
      
      // Look for ObjectId (24 hex chars)
      const objectIdMatch = transactionContent?.match(/[0-9a-fA-F]{24}/);
      if (objectIdMatch) {
        studentId = objectIdMatch[0];
      } else {
        // Alternative: Try to find a student code if you use custom short IDs
        // E.g. match HD-1234
        const words = transactionContent?.split(/\s+/) || [];
        for (const word of words) {
          if (word.length >= 6) { // Just a heuristic
             studentId = word;
          }
        }
      }

      if (studentId) {
        // Find the student
        let student = null;
        if (objectIdMatch) {
          student = await Student.findById(studentId);
        } else {
          student = await Student.findOne({ id: studentId }); // Assuming custom ID field
        }

        if (student) {
          // Add payment history
          const paymentRecord = {
            amount: amountIn,
            date: transactionDate ? new Date(transactionDate).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN'),
            method: 'Chuyển khoản',
            note: `[SePay] ${transactionContent}`,
            recipient: 'Hệ thống tự động',
          };

          student.paymentHistory = student.paymentHistory || [];
          student.paymentHistory.push(paymentRecord);
          
          // Update paid amount if it is a field
          student.paidAmount = (student.paidAmount || 0) + amountIn;

          await student.save();
          console.log(`Successfully processed webhook payment for student ${student._id}`);
        } else {
          console.log(`Student not found for extracted ID: ${studentId}`);
        }
      }
    }

    return res.status(200).json({ success: true, message: 'Webhook processed successfully' });
  } catch (error: any) {
    console.error('SePay Webhook processing error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
