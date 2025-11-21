import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default defineEventHandler(async (event) => {
  if (getMethod(event) === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const userData = await readBody(event);
    if (!userData || typeof userData !== 'object') {
      return new Response(JSON.stringify({ success: false, error: '请求体为空或格式错误' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return new Response(JSON.stringify({ success: false, error: '缺少 Supabase 环境变量' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data, error } = await supabase
      .from('Tasks')
      .insert([{ user_data: userData, status: 'PENDING' }])
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, status: 'PENDING', taskId: data.id }), {
      status: 202,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: `龙猫服务器错误 (Cloudflare): ${(error as Error).message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  }
});
