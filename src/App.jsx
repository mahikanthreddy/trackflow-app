import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [transactions, setTransactions] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const [text, setText] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [dateInput, setDateInput] = useState(() => new Date().toISOString().split('T')[0]);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [settleModalData, setSettleModalData] = useState(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [forgiveRemaining, setForgiveRemaining] = useState(false);
  const [settleDateInput, setSettleDateInput] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetch('/api/transactions')
      .then(res => res.json())
      .then(data => {
        if (data.length > 0) {
          setTransactions(data);
        } else {
          // If server is empty, fallback to local storage
          const saved = localStorage.getItem('expenses_data');
          if (saved) setTransactions(JSON.parse(saved));
        }
        setIsLoaded(true);
      })
      .catch(err => {
        console.error('Failed to load data from server, falling back to local storage', err);
        const saved = localStorage.getItem('expenses_data');
        if (saved) setTransactions(JSON.parse(saved));
        setIsLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    
    // Save to server
    fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transactions)
    }).catch(err => console.error('Failed to save data to server', err));

    // Also backup to local storage
    localStorage.setItem('expenses_data', JSON.stringify(transactions));
  }, [transactions, isLoaded]);

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const addTransaction = (e) => {
    e.preventDefault();
    if (!text || !amount || !dateInput) return;

    const newTransaction = {
      id: crypto.randomUUID(),
      text,
      amount: parseFloat(amount),
      type,
      date: formatDate(dateInput),
      phone: phone.trim(),
      address: address.trim()
    };

    setTransactions([newTransaction, ...transactions]);
    setText('');
    setAmount('');
    setDateInput(new Date().toISOString().split('T')[0]);
    setPhone('');
    setAddress('');
  };

  const deleteTransaction = (id) => {
    setTransactions(transactions.filter(t => t.id !== id));
  };

  const openSettleModal = (transaction) => {
    setSettleModalData(transaction);
    setSettleAmount(transaction.amount.toString());
    setForgiveRemaining(false);
    setSettleDateInput(new Date().toISOString().split('T')[0]);
  };

  const closeSettleModal = () => {
    setSettleModalData(null);
  };

  const handleSettle = (e) => {
    e.preventDefault();
    const amountPaid = parseFloat(settleAmount);
    if (isNaN(amountPaid) || amountPaid <= 0 || !settleDateInput) return;

    const original = settleModalData;
    const remaining = original.amount - amountPaid;

    const otherTransactions = transactions.filter(t => t.id !== original.id);

    const settledTransaction = {
      id: crypto.randomUUID(),
      text: `${original.text} (Settled)`,
      amount: amountPaid,
      type: original.type === 'to-pay' ? 'expense' : 'income',
      date: formatDate(settleDateInput),
      phone: original.phone,
      address: original.address
    };

    let newTransactionsList = [settledTransaction];

    if (remaining > 0 && !forgiveRemaining) {
      const updatedPending = {
        ...original,
        amount: remaining
      };
      newTransactionsList.push(updatedPending);
    }

    setTransactions([...newTransactionsList, ...otherTransactions]);
    closeSettleModal();
  };

  // Calculate values
  const income = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);
    
  const expense = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const total = (income - expense).toFixed(2);
  
  const toPay = transactions
    .filter(t => t.type === 'to-pay')
    .reduce((acc, t) => acc + t.amount, 0).toFixed(2);
    
  const toGet = transactions
    .filter(t => t.type === 'to-get')
    .reduce((acc, t) => acc + t.amount, 0).toFixed(2);

  const filteredTransactions = transactions.filter(t => {
    const matchesFilter = filter === 'all' || t.type === filter;
    const matchesSearch = t.text.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getIcon = (type) => {
    switch(type) {
      case 'income': return '↓';
      case 'expense': return '↑';
      case 'to-pay': return '↗';
      case 'to-get': return '↙';
      default: return '•';
    }
  };

  const getSign = (type) => {
    if (type === 'income' || type === 'to-get') return '+';
    return '-';
  };

  const downloadCSV = () => {
    const headers = ['Date', 'Description', 'Phone', 'Address', 'Type', 'Income (₹)', 'Expense (₹)', 'To Get (₹)', 'To Pay (₹)'];
    const rows = transactions.map(t => [
      `"${t.date}"`,
      `"${t.text}"`,
      `"${t.phone || ''}"`,
      `"${t.address || ''}"`,
      `"${t.type}"`,
      t.type === 'income' ? t.amount : '',
      t.type === 'expense' ? t.amount : '',
      t.type === 'to-get' ? t.amount : '',
      t.type === 'to-pay' ? t.amount : ''
    ].join(','));
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'trackflow_transactions.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="app-container">
      <div className="left-panel">
        <div className="header">
          <h1>TrackFlow</h1>
          <p>Beautiful Expense Management</p>
        </div>

        <div className="balance-card glass-panel">
          <div className="balance-title">Total Balance</div>
          <div className="balance-amount">₹{total}</div>
          
          <div className="summary-container">
            <div className="summary-box">
              <h3>Income</h3>
              <div className="amount income-amount">+₹{income.toFixed(2)}</div>
            </div>
            <div className="summary-box">
              <h3>Expense</h3>
              <div className="amount expense-amount">-₹{expense.toFixed(2)}</div>
            </div>
            <div className="summary-box">
              <h3>To Get (Pending)</h3>
              <div className="amount to-get-amount">+₹{toGet}</div>
            </div>
            <div className="summary-box">
              <h3>To Pay (Pending)</h3>
              <div className="amount to-pay-amount">-₹{toPay}</div>
            </div>
          </div>
        </div>

        <form className="form-section glass-panel" onSubmit={addTransaction}>
          <h2>New Transaction</h2>
          
          <div className="form-group">
            <label>Description / Name</label>
            <input 
              type="text" 
              className="form-control" 
              value={text} 
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Salary, John Doe, Groceries"
              required
            />
          </div>

          <div className="form-group">
            <label>Amount (₹)</label>
            <input 
              type="number" 
              className="form-control" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0.01"
              required
            />
          </div>

          <div className="form-group">
            <label>Date</label>
            <input 
              type="date" 
              className="form-control" 
              value={dateInput} 
              onChange={(e) => setDateInput(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Phone Number (Optional)</label>
            <input 
              type="tel" 
              className="form-control" 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 9876543210"
            />
          </div>

          <div className="form-group">
            <label>Address (Optional)</label>
            <input 
              type="text" 
              className="form-control" 
              value={address} 
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 123 Main St, Mumbai"
            />
          </div>

          <div className="form-group">
            <label>Type</label>
            <div className="radio-group">
              <div className="radio-option">
                <input 
                  type="radio" 
                  name="type" 
                  id="expense" 
                  checked={type === 'expense'}
                  onChange={() => setType('expense')}
                />
                <label htmlFor="expense" className="radio-label expense-label">Expense</label>
              </div>
              <div className="radio-option">
                <input 
                  type="radio" 
                  name="type" 
                  id="income" 
                  checked={type === 'income'}
                  onChange={() => setType('income')}
                />
                <label htmlFor="income" className="radio-label income-label">Income</label>
              </div>
              <div className="radio-option">
                <input 
                  type="radio" 
                  name="type" 
                  id="to-pay" 
                  checked={type === 'to-pay'}
                  onChange={() => setType('to-pay')}
                />
                <label htmlFor="to-pay" className="radio-label to-pay-label">To Pay</label>
              </div>
              <div className="radio-option">
                <input 
                  type="radio" 
                  name="type" 
                  id="to-get" 
                  checked={type === 'to-get'}
                  onChange={() => setType('to-get')}
                />
                <label htmlFor="to-get" className="radio-label to-get-label">To Get</label>
              </div>
            </div>
          </div>

          <button type="submit" className="submit-btn">Add Transaction</button>
        </form>
      </div>

      <div className="right-panel glass-panel transactions-section">
        <div className="transactions-header">
          <h2>Recent History</h2>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <div className="filter-group">
              <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
              <button className={`filter-btn ${filter === 'income' ? 'active' : ''}`} onClick={() => setFilter('income')}>Income</button>
              <button className={`filter-btn ${filter === 'expense' ? 'active' : ''}`} onClick={() => setFilter('expense')}>Expense</button>
              <button className={`filter-btn ${filter === 'to-pay' ? 'active' : ''}`} onClick={() => setFilter('to-pay')}>To Pay</button>
              <button className={`filter-btn ${filter === 'to-get' ? 'active' : ''}`} onClick={() => setFilter('to-get')}>To Get</button>
            </div>
            <button className="export-btn" onClick={downloadCSV}>
              ↓ Export CSV
            </button>
          </div>
        </div>

        <input 
          type="text" 
          className="search-input" 
          placeholder="Search transactions by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        {filteredTransactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <h3>No transactions found</h3>
            <p>Adjust your search or add some transactions.</p>
          </div>
        ) : (
          <ul className="transaction-list">
            {filteredTransactions.map(transaction => (
              <li key={transaction.id} className={`transaction-item ${transaction.type} animate-fade-in`}>
                <div className="transaction-info">
                  <div className="transaction-icon">
                    {getIcon(transaction.type)}
                  </div>
                  <div className="transaction-details">
                    <h4>{transaction.text}</h4>
                    <span className="transaction-date">{transaction.date}</span>
                    {(transaction.phone || transaction.address) && (
                      <div className="transaction-extra">
                        {transaction.phone && <span className="extra-item">📞 {transaction.phone}</span>}
                        {transaction.address && <span className="extra-item">📍 {transaction.address}</span>}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="transaction-amount-wrapper">
                  <div className="transaction-amount">
                    {getSign(transaction.type)}₹{transaction.amount.toFixed(2)}
                  </div>

                  <div className="transaction-actions">
                    {(transaction.type === 'to-pay' || transaction.type === 'to-get') && (
                      <button 
                        className="settle-btn" 
                        onClick={() => openSettleModal(transaction)}
                        title="Mark as Settled"
                      >
                        Settle
                      </button>
                    )}
                    
                    <button 
                      className="delete-btn" 
                      onClick={() => deleteTransaction(transaction.id)}
                      title="Delete Transaction"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Settlement Modal */}
      {settleModalData && (
        <div className="modal-overlay" onClick={closeSettleModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Settle Transaction</h3>
              <button className="close-modal-btn" onClick={closeSettleModal}>✕</button>
            </div>
            
            <form onSubmit={handleSettle}>
              <div className="form-group">
                <label>Amount Being Settled</label>
                <input 
                  type="number" 
                  className="form-control"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  max={settleModalData.amount}
                  min="0.01"
                  step="0.01"
                  required
                />
                <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem'}}>
                  Total Due: ₹{settleModalData.amount.toFixed(2)}
                </p>
              </div>

              <div className="form-group">
                <label>Settlement Date</label>
                <input 
                  type="date" 
                  className="form-control"
                  value={settleDateInput}
                  onChange={(e) => setSettleDateInput(e.target.value)}
                  required
                />
              </div>

              {parseFloat(settleAmount) < settleModalData.amount && !isNaN(parseFloat(settleAmount)) && (
                <div className="checkbox-group">
                  <input 
                    type="checkbox" 
                    id="forgive" 
                    checked={forgiveRemaining}
                    onChange={(e) => setForgiveRemaining(e.target.checked)}
                  />
                  <label htmlFor="forgive">
                    Forgive / Write-off remaining ₹{(settleModalData.amount - parseFloat(settleAmount)).toFixed(2)}
                  </label>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={closeSettleModal}>Cancel</button>
                <button type="submit" className="confirm-btn">Confirm Settle</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
