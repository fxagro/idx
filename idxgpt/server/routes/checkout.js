const express = require('express');
const jwt = require('jsonwebtoken');

module.exports = function(db, upload){
  const router = express.Router();
  const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

  function auth(req,res,next){
    const h = req.headers.authorization||'';
    const t = h.startsWith('Bearer ')?h.slice(7):null;
    if(!t) return res.status(401).json({error:'Unauthorized'});
    try{
      req.user = jwt.verify(t, JWT_SECRET);
      next();
    }catch(e){
      return res.status(401).json({error:'Invalid token'});
    }
  }

  // Create pending transaction
  router.post('/create', auth, async (req,res)=>{
    const { planId, payerName } = req.body;
    await db.read();
    const plan = db.data.plans.find(p=>p.id===planId);
    if(!plan) return res.status(400).json({error:'Paket tidak ditemukan'});

    const tx = {
      id: 'tx_'+Date.now(),
      userId: req.user.uid,
      planId,
      amount: plan.price,
      status: 'pending', // pending -> paid -> activated
      payerName: payerName||'',
      proofPath: null,
      createdAt: new Date().toISOString()
    };
    db.data.transactions.push(tx);
    await db.write();

    res.json({ tx, bca: { account: process.env.BCA_ACCOUNT || '123-456-7890', name: process.env.BCA_NAME || 'PT IDXGPT' } });
  });

  // Upload proof
  router.post('/upload/:txId', auth, upload.single('proof'), async (req,res)=>{
    const { txId } = req.params;
    await db.read();
    const tx = db.data.transactions.find(t=>t.id===txId && t.userId===req.user.uid);
    if(!tx) return res.status(404).json({error:'Transaksi tidak ditemukan'});
    if(!req.file) return res.status(400).json({error:'File bukti wajib diupload'});

    tx.proofPath = '/uploads/' + req.file.filename;
    tx.status = 'waiting_verification';
    await db.write();
    res.json({ ok:true, tx });
  });

  return router;
}
